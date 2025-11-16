// Load environment variables from .env file (only for local development)
// On Cloud Run, environment variables are set via console/CLI
try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv not available (running in production)');
}

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Firestore } = require('@google-cloud/firestore');
// ⚠️ REMOVED: Google Translate API no longer needed (translation runs client-side)
// const { Translate } = require('@google-cloud/translate').v2;

const app = express();
const PORT = process.env.PORT || 8080;

// Environment variables
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
const LOCATION = process.env.VERTEX_AI_LOCATION || 'us-central1';
const LEMON_SQUEEZY_WEBHOOK_SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
const LEMON_SQUEEZY_STORE_ID = process.env.LEMON_SQUEEZY_STORE_ID;
const LEMON_SQUEEZY_VARIANT_ID = process.env.LEMON_SQUEEZY_VARIANT_ID;
const TEST_PREMIUM_KEY = process.env.TEST_PREMIUM_KEY || null;

// Email configuration
const EMAIL_USER = process.env.EMAIL_USER || 'alvesoscar517@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS; // App password from Gmail
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'localizeai.care@gmail.com';

// Log configuration on startup
console.log('=== LocalizeAI Backend Configuration ===');
console.log('Project ID:', PROJECT_ID);
console.log('Location:', LOCATION);
console.log('Lemon Squeezy Store ID:', LEMON_SQUEEZY_STORE_ID || 'NOT CONFIGURED');
console.log('Lemon Squeezy Variant ID:', LEMON_SQUEEZY_VARIANT_ID || 'NOT CONFIGURED');
console.log('Webhook Secret:', LEMON_SQUEEZY_WEBHOOK_SECRET ? 'CONFIGURED' : 'NOT CONFIGURED');
console.log('Email User:', EMAIL_USER);
console.log('Email Password:', EMAIL_PASS ? 'CONFIGURED' : 'NOT CONFIGURED');
console.log('Support Email:', SUPPORT_EMAIL);
console.log('========================================');

// Initialize services
let db, mailTransporter;
try {
  db = new Firestore();
  // translate removed - no longer needed (translation runs client-side)
  console.log('✅ Google Cloud services initialized');
} catch (error) {
  console.error('⚠️ Warning: Could not initialize Google Cloud services:', error.message);
  console.log('Some features may not work without proper credentials');
}

// Initialize email transporter
if (EMAIL_PASS) {
  try {
    mailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
      }
    });
    console.log('✅ Email service initialized');
  } catch (error) {
    console.error('⚠️ Warning: Could not initialize email service:', error.message);
  }
} else {
  console.log('⚠️ Email service not configured (EMAIL_PASS not set)');
}

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Special handling for webhook - need raw body for signature verification
app.use('/webhook/lemon-squeezy', express.raw({ type: 'application/json' }));

// Regular JSON parsing for other routes
app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'LocalizeAI API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Google Authentication
// Note: We don't store or return user's picture/name from backend
// Client gets those directly from Google API for better privacy and freshness
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    // Verify Google token (only need email for user identification)
    const userInfo = await verifyGoogleToken(token);
    
    if (!userInfo) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user exists
    let userDoc = await db.collection('users').doc(userInfo.email).get();
    let userData;
    let apiKey;

    if (userDoc.exists) {
      // Existing user - update last login
      userData = userDoc.data();
      apiKey = userData.apiKey;
      
      await db.collection('users').doc(userInfo.email).update({
        lastLogin: Firestore.FieldValue.serverTimestamp()
      });
    } else {
      // New user - create account with simplified structure
      apiKey = generateApiKey();
      
      userData = {
        email: userInfo.email, // Email is the document ID
        apiKey,
        isPremium: false,
        // translationUsageCount removed - translation is now free and unlimited via client-side
        createdAt: Firestore.FieldValue.serverTimestamp(),
        lastLogin: Firestore.FieldValue.serverTimestamp(),
        // Lemon Squeezy payment info
        lemonSqueezy: {
          customerId: null,
          subscriptionId: null,
          orderId: null,
          variantId: null,
          status: null // active, cancelled, expired, paused, past_due
        },
        // Subscription dates
        subscriptionStartDate: null,
        subscriptionEndDate: null, // User can use until this date even if cancelled
        subscriptionCancelledAt: null // When user cancelled (but still has access until endDate)
      };

      await db.collection('users').doc(userInfo.email).set(userData);
    }

    // Return user data (no need to return picture - client gets it directly from Google)
    res.json({
      user: {
        email: userInfo.email,
        isPremium: userData.isPremium || false
      },
      apiKey
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ⚠️ DEPRECATED: Translation now runs client-side (free, no backend needed)
// This endpoint is kept for backward compatibility only
// New clients should use translate-client.js for free client-side translation
app.post('/api/translate', async (req, res) => {
  return res.status(410).json({ 
    error: 'Translation endpoint deprecated',
    message: 'Translation now runs client-side using free Google Translate API. Please update your extension to the latest version.',
    deprecated: true,
    useClientSide: true
  });
});

// AI Translation for JSON (Premium feature)
app.post('/api/translate-json-ai', async (req, res) => {
  try {
    const { text, sourceLang, targetLang, format } = req.body;
    const apiKey = req.headers.authorization?.replace('Bearer ', '');

    // Validation
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Missing text or targetLang' });
    }

    if (text.length > 2000) {
      return res.status(400).json({ error: 'Text too long (max 2000 characters per request)' });
    }

    // Check authentication
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please sign in to use AI translation'
      });
    }

    const user = await getUserByApiKey(apiKey);
    if (!user) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // ✅ Premium feature only
    if (!user.isPremium) {
      return res.status(403).json({ 
        error: 'Premium feature',
        message: 'AI translation requires Premium subscription'
      });
    }

    // ⚠️ STRICT RATE LIMITING for free Gemini model
    // Gemini 2.0 Flash Exp: 10 requests/minute, 1000 requests/day
    const now = Date.now();
    const userRateKey = `ai_json_rate_${user.email}`;
    
    // Check rate limit (simple in-memory, should use Redis in production)
    if (!global.aiRateLimits) global.aiRateLimits = new Map();
    
    const userRate = global.aiRateLimits.get(userRateKey) || { count: 0, resetTime: now + 60000 };
    
    if (now > userRate.resetTime) {
      // Reset counter
      userRate.count = 0;
      userRate.resetTime = now + 60000; // 1 minute window
    }
    
    if (userRate.count >= 8) { // Max 8 requests per minute per user (allows ~80 keys/min)
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'AI translation: Maximum 8 requests per minute. Please wait.',
        retryAfter: Math.ceil((userRate.resetTime - now) / 1000)
      });
    }
    
    userRate.count++;
    global.aiRateLimits.set(userRateKey, userRate);

    console.log(`AI JSON Translation: "${text.substring(0, 50)}..." from ${sourceLang || 'auto'} to ${targetLang}`);

    // Use Gemini 2.0 Flash Exp (free)
    const { VertexAI } = require('@google-cloud/vertexai');
    const vertexAI = new VertexAI({ 
      project: PROJECT_ID, 
      location: LOCATION 
    });
    
    const model = vertexAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp'
    });

    // ✅ Detect format and build context-aware prompt
    const formatInfo = detectTextFormat(text);
    
    const prompt = `You are a professional translator specializing in UI/UX localization.

TASK: Translate this ${formatInfo.type} text from ${sourceLang || 'auto'} to ${targetLang}

SOURCE TEXT: "${text}"

FORMAT CONTEXT: ${formatInfo.description}

⚠️ CRITICAL PLACEHOLDER RULES - DO NOT TRANSLATE THESE:
1. NEVER translate placeholders - keep them EXACTLY as they appear:
   - $COUNT$, $MAX$, $REQUESTS$, $FILENAME$, $LANG$, $ID$, $SIZE$, $TIME$ → Keep as-is
   - $1, $2, $3 → Keep as-is
   - {name}, {count}, {value} → Keep as-is
   - %s, %d, %1$s → Keep as-is
   - {{variable}} → Keep as-is
   - <0>text</0> → Keep tags, translate "text" only
   - @:key → Keep as-is

2. Translate ONLY the surrounding text, NOT the placeholders
3. Keep translation natural and appropriate for UI context
4. Maintain same tone and formality level
5. Keep similar length to avoid UI overflow
6. Use proper grammar and natural phrasing in ${targetLang}
7. For pluralization: maintain structure (one/other/few/many)
8. Return ONLY the translated text, no explanations or quotes

CORRECT EXAMPLES:
✅ "You have $COUNT$ items" → (Vietnamese) "Bạn có $COUNT$ mục"
✅ "Welcome {name}!" → (French) "Bienvenue {name} !"
✅ "Max $MAX$ languages" → (Spanish) "Máximo $MAX$ idiomas"
✅ "Hello %s" → (German) "Hallo %s"

WRONG EXAMPLES (DO NOT DO THIS):
❌ "You have $COUNT$ items" → "Bạn có SỐ LƯỢNG mục" (placeholder translated)
❌ "Max $MAX$ languages" → "Máximo MÁXIMO idiomas" (placeholder translated)

TRANSLATED TEXT:`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    let translatedText = response.text().trim().replace(/^["']|["']$/g, '');
    
    console.log(`AI Translation result: "${translatedText.substring(0, 50)}..."`);
    
    res.json({ translatedText });
  } catch (error) {
    console.error('AI JSON translation error:', error);
    res.status(500).json({ 
      error: 'AI translation failed',
      message: error.message
    });
  }
});

// AI Suggestions (Premium feature)
app.post('/api/ai-suggest', async (req, res) => {
  try {
    const { text, language, context, elementType, pageTitle, pageUrl } = req.body;
    const apiKey = req.headers.authorization?.replace('Bearer ', '');

    // Check premium access
    if (!apiKey) {
      return res.status(403).json({ error: 'Premium feature - API key required' });
    }

    const user = await getUserByApiKey(apiKey);
    if (!user || !user.isPremium) {
      return res.status(403).json({ error: 'Premium feature - Upgrade to access' });
    }

    // Get AI suggestions using Vertex AI with rich context
    const pageInfo = { pageTitle, pageUrl };
    const suggestions = await getAISuggestions(
      text, 
      language || 'en',
      context, 
      elementType || 'text',
      pageInfo
    );

    // Track usage
    await incrementUsage(apiKey, 'ai_suggestions');

    res.json({ suggestions });
  } catch (error) {
    console.error('AI suggestion error:', error);
    res.status(500).json({ error: 'AI suggestion failed', details: error.message });
  }
});

// AI Quality Check (Premium feature) - Check SOURCE text quality
app.post('/api/quality-check', async (req, res) => {
  try {
    const { sourceTexts, sourceLang } = req.body; // Array of {text, element}
    const apiKey = req.headers.authorization?.replace('Bearer ', '');

    // Check premium access
    if (!apiKey) {
      return res.status(403).json({ error: 'Premium feature - API key required' });
    }

    const user = await getUserByApiKey(apiKey);
    if (!user || !user.isPremium) {
      return res.status(403).json({ error: 'Premium feature - Upgrade to access' });
    }

    console.log(`Quality checking ${sourceTexts.length} source texts in ${sourceLang || 'auto'}`);

    // Check quality of source text (spelling, grammar, formatting)
    const issues = await checkSourceTextQuality(sourceTexts, sourceLang);

    // Track usage
    await incrementUsage(apiKey, 'quality_checks');

    // Determine overall quality status
    const hasIssues = issues.length > 0;
    const qualityStatus = hasIssues ? 'issues_found' : 'perfect';
    
    res.json({ 
      issues,
      total: sourceTexts.length,
      issuesFound: issues.length,
      qualityStatus,
      message: hasIssues 
        ? `Found ${issues.length} issue(s) in source text`
        : `All ${sourceTexts.length} texts are good - no issues found`
    });
  } catch (error) {
    console.error('Quality check error:', error);
    res.status(500).json({ error: 'Quality check failed' });
  }
});

// Smart Batch Translate (Premium feature)
app.post('/api/smart-translate', async (req, res) => {
  try {
    const { texts, sourceLang, targetLang, glossary } = req.body;
    const apiKey = req.headers.authorization?.replace('Bearer ', '');

    // Check premium access
    if (!apiKey) {
      return res.status(403).json({ error: 'Premium feature - API key required' });
    }

    const user = await getUserByApiKey(apiKey);
    if (!user || !user.isPremium) {
      return res.status(403).json({ error: 'Premium feature - Upgrade to access' });
    }

    // Smart translate with context
    const translationResults = await smartTranslateWithContext(texts, sourceLang, targetLang, glossary);

    // Return full translation objects with metadata
    const translations = translationResults
      .sort((a, b) => a.index - b.index)
      .map(t => ({
        original: t.original,
        translated: t.translated,
        index: t.index
      }));

    // Track usage
    await incrementUsage(apiKey, 'smart_translations');

    res.json({ 
      translations,
      total: texts.length,
      translated: translations.length
    });
  } catch (error) {
    console.error('Smart translate error:', error);
    res.status(500).json({ error: 'Smart translation failed' });
  }
});

// Bug report endpoint removed - now using local IndexedDB storage only

// ⚠️ DEPRECATED: JSON translation now runs client-side (free, no backend needed)
// This endpoint is kept for backward compatibility only
// New clients should use translate-client.js for free client-side translation
app.post('/api/translate-json', async (req, res) => {
  return res.status(410).json({ 
    error: 'JSON translation endpoint deprecated',
    message: 'JSON translation now runs client-side using free Google Translate API. Please update your extension to the latest version.',
    deprecated: true,
    useClientSide: true
  });
});

// ⚠️ REMOVED: JSON translation helper functions
// These are no longer needed as JSON translation runs client-side
// Removed functions:
// - detectI18nFormat()
// - extractStringsFromJSON()
// - rebuildJSON()
// - translateWithAI() (for JSON)

// Helper: Detect text format for better AI translation
function detectTextFormat(text) {
  const formats = [];
  
  // Check for various placeholder formats
  if (/\$[A-Z_]+\$/.test(text)) {
    formats.push('Chrome i18n ($PLACEHOLDER$)');
  }
  if (/\{[a-zA-Z_]+\}/.test(text)) {
    formats.push('ICU MessageFormat ({variable})');
  }
  if (/%[sd]|%\d+\$[sd]/.test(text)) {
    formats.push('Printf format (%s, %d)');
  }
  if (/\{\{[a-zA-Z_]+\}\}/.test(text)) {
    formats.push('React i18n ({{variable}})');
  }
  if (/<\d+>.*<\/\d+>/.test(text)) {
    formats.push('React i18n tags (<0>text</0>)');
  }
  if (/@:[a-zA-Z_]+/.test(text)) {
    formats.push('Vue i18n (@:key)');
  }
  
  if (formats.length === 0) {
    return {
      type: 'simple UI',
      description: 'Simple text without placeholders'
    };
  }
  
  return {
    type: 'i18n/l10n',
    description: `Contains ${formats.join(', ')} placeholders`
  };
}

// Subscription status
app.get('/api/subscription/status', async (req, res) => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '');

    if (!apiKey) {
      return res.json({
        isPremium: false,
        email: null,
        name: null
      });
    }

    const user = await getUserByApiKey(apiKey);
    if (!user) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Check if subscription expired
    let isPremium = user.isPremium || false;
    let subscriptionEndDate = null;
    let subscriptionStartDate = null;
    
    if (user.subscriptionEndDate) {
      // Handle both Date objects and Firestore Timestamps
      subscriptionEndDate = user.subscriptionEndDate.toDate ? user.subscriptionEndDate.toDate() : user.subscriptionEndDate;
      
      // If subscription expired, downgrade to free
      if (subscriptionEndDate < new Date()) {
        isPremium = false;
        // Update user in database
        await db.collection('users').doc(user.email).update({ 
          isPremium: false,
          'lemonSqueezy.status': 'expired'
        });
      }
    }
    
    if (user.subscriptionStartDate) {
      subscriptionStartDate = user.subscriptionStartDate.toDate ? user.subscriptionStartDate.toDate() : user.subscriptionStartDate;
    }

    res.json({
      isPremium,
      email: user.email,
      subscriptionStartDate: subscriptionStartDate?.toISOString(),
      subscriptionEndDate: subscriptionEndDate?.toISOString(),
      subscriptionCancelledAt: user.subscriptionCancelledAt?.toDate ? user.subscriptionCancelledAt.toDate().toISOString() : null,
      lemonSqueezy: {
        status: user.lemonSqueezy?.status || null,
        subscriptionId: user.lemonSqueezy?.subscriptionId || null,
        customerId: user.lemonSqueezy?.customerId || null,
        variantId: user.lemonSqueezy?.variantId || null
      }
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Cron job endpoint to check and expire subscriptions (call this daily)
app.post('/api/cron/check-subscriptions', async (req, res) => {
  try {
    // Verify cron job secret (optional but recommended)
    const cronSecret = req.headers['x-cron-secret'];
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('🔄 Running subscription expiration check...');
    
    const now = new Date();
    let expiredCount = 0;
    let checkedCount = 0;

    // Get all premium users
    const snapshot = await db.collection('users')
      .where('isPremium', '==', true)
      .get();

    for (const doc of snapshot.docs) {
      checkedCount++;
      const userData = doc.data();
      
      if (userData.subscriptionEndDate) {
        const endDate = userData.subscriptionEndDate.toDate ? userData.subscriptionEndDate.toDate() : userData.subscriptionEndDate;
        
        // Check if subscription has expired
        if (endDate < now) {
          await doc.ref.update({
            isPremium: false,
            'lemonSqueezy.status': 'expired',
            lastUpdated: Firestore.FieldValue.serverTimestamp()
          });
          
          expiredCount++;
          console.log(`❌ Expired subscription for: ${doc.id}`);
        }
      }
    }

    console.log(`✅ Subscription check complete: ${checkedCount} checked, ${expiredCount} expired`);
    
    res.json({
      success: true,
      checked: checkedCount,
      expired: expiredCount,
      timestamp: now.toISOString()
    });
  } catch (error) {
    console.error('Cron job error:', error);
    res.status(500).json({ error: 'Cron job failed' });
  }
});

// Support page
app.get('/support', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Contact Support - LocalizeAI</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fbbf24 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
        }
        .container {
          max-width: 700px;
          width: 100%;
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
          padding: 60px;
        }
        .header {
          text-align: center;
          margin-bottom: 48px;
        }
        .header-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 24px;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(251, 191, 36, 0.3);
        }
        .header h1 {
          font-size: 32px;
          color: #111827;
          margin-bottom: 12px;
          font-weight: 700;
        }
        .header p {
          font-size: 16px;
          color: #6b7280;
        }
        .form-group {
          margin-bottom: 24px;
        }
        label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }
        label svg {
          width: 18px;
          height: 18px;
          color: #fbbf24;
        }
        input, textarea {
          width: 100%;
          padding: 14px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 15px;
          font-family: inherit;
          transition: all 0.2s;
          color: #111827;
        }
        input:focus, textarea:focus {
          outline: none;
          border-color: #fbbf24;
          box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.1);
        }
        input::placeholder, textarea::placeholder {
          color: #9ca3af;
        }
        textarea {
          resize: vertical;
          min-height: 150px;
          line-height: 1.6;
        }
        .btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(251, 191, 36, 0.4);
        }
        .btn:active {
          transform: translateY(0);
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .message {
          padding: 16px 20px;
          border-radius: 8px;
          margin-bottom: 24px;
          font-size: 15px;
          display: none;
          align-items: center;
          gap: 12px;
        }
        .message.success {
          background: #d1fae5;
          color: #065f46;
          border: 2px solid #6ee7b7;
        }
        .message.error {
          background: #fee2e2;
          color: #991b1b;
          border: 2px solid #fca5a5;
        }
        .footer {
          text-align: center;
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
          color: #9ca3af;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h1>Contact Support</h1>
          <p>We're here to help you with any questions or issues</p>
        </div>
        
        <div id="message" class="message"></div>
        
        <form id="support-form">
          <div class="form-group">
            <label for="title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              Subject
            </label>
            <input type="text" id="title" name="title" required placeholder="Brief description of your issue">
          </div>
          
          <div class="form-group">
            <label for="email">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Your Email
            </label>
            <input type="email" id="email" name="email" required placeholder="your@email.com">
          </div>
          
          <div class="form-group">
            <label for="content">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Message
            </label>
            <textarea id="content" name="content" required placeholder="Please describe your issue in detail..."></textarea>
          </div>
          
          <button type="submit" class="btn" id="submit-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            Send Message
          </button>
        </form>
        
        <div class="footer">
          Response time: 24-48 hours
        </div>
      </div>
      
      <script>
        const form = document.getElementById('support-form');
        const submitBtn = document.getElementById('submit-btn');
        const messageEl = document.getElementById('message');
        
        function showMessage(text, type) {
          messageEl.innerHTML = type === 'success' 
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' + text
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>' + text;
          messageEl.className = 'message ' + type;
          messageEl.style.display = 'flex';
          
          if (type === 'success') {
            setTimeout(() => {
              messageEl.style.display = 'none';
            }, 5000);
          }
        }
        
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const title = document.getElementById('title').value;
          const email = document.getElementById('email').value;
          const content = document.getElementById('content').value;
          
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>Sending...';
          
          try {
            const response = await fetch('/api/support/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ title, email, content })
            });
            
            const data = await response.json();
            
            if (response.ok) {
              showMessage('Your message has been sent successfully! We will respond soon.', 'success');
              form.reset();
            } else {
              showMessage(data.error || 'Something went wrong. Please try again.', 'error');
            }
          } catch (error) {
            showMessage('Unable to connect to server. Please try again later.', 'error');
          } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>Send Message';
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Support email endpoint
app.post('/api/support/send', async (req, res) => {
  try {
    const { title, email, content } = req.body;
    
    if (!title || !email || !content) {
      return res.status(400).json({ error: 'Please fill in all fields' });
    }
    
    // Save support request to Firestore
    const docRef = await db.collection('support_requests').add({
      title,
      email,
      content,
      status: 'pending',
      createdAt: Firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Support request saved to Firestore:', docRef.id);
    
    // Send email if configured
    if (mailTransporter) {
      try {
        const mailOptions = {
          from: `LocalizeAI Support <${EMAIL_USER}>`,
          to: SUPPORT_EMAIL,
          replyTo: email,
          subject: `[Support] ${title}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #111827;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 0;
                  background: #f9fafb;
                }
                .container {
                  background: white;
                  margin: 40px 20px;
                  border-radius: 8px;
                  overflow: hidden;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .header {
                  background: #fbbf24;
                  padding: 32px 24px;
                  text-align: center;
                }
                .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 700;
                  color: white;
                }
                .content {
                  padding: 32px 24px;
                }
                .field {
                  margin-bottom: 24px;
                }
                .field-label {
                  font-size: 12px;
                  font-weight: 600;
                  color: #6b7280;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  margin-bottom: 8px;
                }
                .field-value {
                  font-size: 15px;
                  color: #111827;
                }
                .field-value a {
                  color: #fbbf24;
                  text-decoration: none;
                }
                .field-value a:hover {
                  text-decoration: underline;
                }
                .message-box {
                  background: #f9fafb;
                  padding: 16px;
                  border-radius: 6px;
                  border-left: 3px solid #fbbf24;
                  white-space: pre-wrap;
                  font-size: 15px;
                  line-height: 1.6;
                }
                .divider {
                  height: 1px;
                  background: #e5e7eb;
                  margin: 24px 0;
                }
                .footer {
                  padding: 24px;
                  background: #f9fafb;
                  text-align: center;
                  font-size: 13px;
                  color: #6b7280;
                }
                .footer p {
                  margin: 8px 0;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>New Support Request</h1>
                </div>
                
                <div class="content">
                  <div class="field">
                    <div class="field-label">From</div>
                    <div class="field-value"><a href="mailto:${email}">${email}</a></div>
                  </div>
                  
                  <div class="field">
                    <div class="field-label">Subject</div>
                    <div class="field-value">${title}</div>
                  </div>
                  
                  <div class="divider"></div>
                  
                  <div class="field">
                    <div class="field-label">Message</div>
                    <div class="message-box">${content}</div>
                  </div>
                  
                  <div class="divider"></div>
                  
                  <div class="field">
                    <div class="field-label">Received</div>
                    <div class="field-value">${new Date().toLocaleString('en-US', { 
                      timeZone: 'Asia/Ho_Chi_Minh',
                      dateStyle: 'full',
                      timeStyle: 'short'
                    })}</div>
                  </div>
                  
                  <div class="field">
                    <div class="field-label">Request ID</div>
                    <div class="field-value">${docRef.id}</div>
                  </div>
                </div>
                
                <div class="footer">
                  <p><strong>Reply directly to this email to respond to the user.</strong></p>
                  <p>LocalizeAI - AI-Powered Localization Tool</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `
New Support Request - LocalizeAI

From: ${email}
Subject: ${title}
Received: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })}
Request ID: ${docRef.id}

Message:
${content}

---
Reply directly to this email to respond to the user.
          `
        };
        
        await mailTransporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully to:', SUPPORT_EMAIL);
        
        res.json({ 
          success: true, 
          message: 'Your support request has been sent successfully! We will respond soon.' 
        });
      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError);
        // Still return success since request was saved to Firestore
        res.json({ 
          success: true, 
          message: 'Your support request has been saved (email failed to send, but saved to system)' 
        });
      }
    } else {
      // Email not configured, just save to Firestore
      console.log('⚠️ Email not sent (service not configured)');
      res.json({ 
        success: true, 
        message: 'Your support request has been saved' 
      });
    }
  } catch (error) {
    console.error('Support request error:', error);
    res.status(500).json({ error: 'Unable to send support request' });
  }
});

// Checkout redirect - directly to Lemon Squeezy
app.get('/checkout', (req, res) => {
  console.log('📦 Checkout request received');
  console.log('Query params:', req.query);
  
  const email = req.query.email || '';
  const checkoutUrl = createLemonSqueezyCheckout(email);
  
  console.log('Generated checkout URL:', checkoutUrl);
  
  if (!checkoutUrl) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Configuration Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center;
            padding: 50px;
            background: #f5f5f5;
          }
          .error {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          h1 { color: #dc3545; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>⚠️ Configuration Error</h1>
          <p>Lemon Squeezy is not configured properly.</p>
          <p>Please contact support.</p>
        </div>
      </body>
      </html>
    `);
  }
  
  // Redirect directly to Lemon Squeezy checkout
  res.redirect(checkoutUrl);
});

// Lemon Squeezy webhook - Handle ALL subscription events
app.post('/webhook/lemon-squeezy', async (req, res) => {
  try {
    // Parse raw body (comes as Buffer from express.raw middleware)
    const rawBody = req.body.toString('utf8');
    const payload = JSON.parse(rawBody);
    
    // Verify signature using raw body
    const signature = req.headers['x-signature'];
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { meta, data } = payload;
    const eventName = meta?.event_name;

    console.log(`📥 Webhook received: ${eventName}`);
    console.log('Data:', JSON.stringify(data, null, 2));

    // Handle all Lemon Squeezy subscription events
    switch (eventName) {
      case 'subscription_created':
        await handleSubscriptionCreated(data);
        break;
      
      case 'subscription_updated':
        await handleSubscriptionUpdated(data);
        break;
      
      case 'subscription_cancelled':
        // User cancelled but still has access until end date
        await handleSubscriptionCancelled(data);
        break;
      
      case 'subscription_resumed':
        // User resumed a cancelled subscription
        await handleSubscriptionResumed(data);
        break;
      
      case 'subscription_expired':
        // Subscription period ended - remove access
        await handleSubscriptionExpired(data);
        break;
      
      case 'subscription_paused':
        // Subscription paused - remove access immediately
        await handleSubscriptionPaused(data);
        break;
      
      case 'subscription_unpaused':
        // Subscription unpaused - restore access
        await handleSubscriptionUnpaused(data);
        break;
      
      case 'subscription_payment_failed':
        // Payment failed - handle gracefully
        await handleSubscriptionPaymentFailed(data);
        break;
      
      case 'subscription_payment_success':
        // Payment succeeded - extend subscription
        await handleSubscriptionPaymentSuccess(data);
        break;
      
      case 'subscription_payment_recovered':
        // Failed payment recovered - restore access
        await handleSubscriptionPaymentRecovered(data);
        break;
      
      case 'order_created':
        // New order created (one-time purchase or subscription start)
        console.log('✅ Order created:', data.id);
        break;
      
      default:
        console.log(`⚠️ Unhandled webhook event: ${eventName}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getAISuggestions(text, language, context, elementType = 'text', pageInfo = {}) {
  try {
    // Use Vertex AI Gemini for smart suggestions
    const { VertexAI } = require('@google-cloud/vertexai');
    const vertexAI = new VertexAI({ 
      project: PROJECT_ID, 
      location: LOCATION 
    });
    
    const model = vertexAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp'
    });

    // Build context-aware prompt
    let contextDescription = context || 'UI element';
    if (pageInfo.pageTitle) {
      contextDescription += ` on page: "${pageInfo.pageTitle}"`;
    }
    if (pageInfo.pageUrl) {
      contextDescription += ` (${pageInfo.pageUrl})`;
    }

    // Element-specific guidelines
    const elementGuidelines = {
      'button': 'Keep it very concise (1-3 words), action-oriented, and imperative. Avoid long phrases.',
      'link': 'Clear and descriptive, but still concise. Should indicate destination.',
      'heading': 'Attention-grabbing and clear. Can be slightly longer than buttons.',
      'label': 'Clear and concise. Should describe the input field purpose.',
      'placeholder': 'Helpful hint, brief and friendly.',
      'menu-item': 'Very concise, typically 1-2 words.',
      'paragraph': 'Natural and flowing. Can be more descriptive.',
      'text': 'Natural and appropriate for context.'
    };

    const guideline = elementGuidelines[elementType] || elementGuidelines['text'];

    const prompt = `You are a professional UX writer and localization expert specializing in UI/UX text.

TASK: Suggest better alternatives for the following text in the SAME language (${language})

Current text: "${text}"
Element type: ${elementType}
Context: ${contextDescription}

REQUIREMENTS:
1. Provide exactly 3 different alternatives in ${language} (same language as the original)
2. ${guideline}
3. More natural, clear, and user-friendly than the original
4. Similar length to original (±30%) to prevent UI overflow
5. Appropriate tone and formality for the UI context
6. Consider modern UX writing best practices

EXAMPLES:
- "Click here" → "Get Started", "Learn More", "Continue"
- "Submit" → "Send Message", "Save Changes", "Confirm"
- "Error" → "Something went wrong", "Unable to process", "Please try again"

FORMAT: Return ONLY the 3 alternative texts, one per line, without numbering, bullet points, explanations, or any extra text.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const suggestions = response.text()
      .trim()
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.match(/^\d+[\.\)]/)) // Remove numbered items
      .map(s => s.replace(/^[-•*]\s*/, '')) // Remove bullet points
      .map(s => s.replace(/^["']|["']$/g, '')) // Remove quotes
      .slice(0, 3);

    // Ensure we have exactly 3 suggestions
    while (suggestions.length < 3) {
      suggestions.push(text); // Fallback to original if not enough suggestions
    }

    return suggestions;
  } catch (error) {
    console.error('Vertex AI error:', error);
    
    // Fallback - return original text variations
    return [text, text, text];
  }
}

async function checkSourceTextQuality(sourceTexts, sourceLang = 'en') {
  try {
    const { VertexAI } = require('@google-cloud/vertexai');
    const vertexAI = new VertexAI({ 
      project: PROJECT_ID, 
      location: LOCATION 
    });
    
    const model = vertexAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp'
    });

    // Prepare source texts for analysis
    const textList = sourceTexts.map((t, i) => 
      `${i}. [${t.element || 'text'}] "${t.text}"`
    ).join('\n');

    const prompt = `You are a professional copy editor. Check these UI texts in ${sourceLang} for errors.

Texts to check:
${textList}

⚠️ CRITICAL INSTRUCTIONS:

1. **ONLY REPORT REAL ERRORS**: Spelling mistakes, grammar errors, typos
2. **DO NOT INVENT PROBLEMS**: If text is correct, return empty array []
3. **NO STYLE SUGGESTIONS**: Don't suggest "improvements" - only fix actual errors
4. **WHEN IN DOUBT, SAY NOTHING**: If unsure, don't report it

✅ ONLY report these OBJECTIVE errors:
- Spelling mistakes (e.g., "recieve" → "receive")
- Grammar errors (e.g., "He don't know" → "He doesn't know")
- Typos (e.g., "Logni" → "Login")
- Inconsistent capitalization in UI (e.g., "save File" → "Save File")
- Missing punctuation that makes text unclear

❌ DO NOT report:
- Style preferences or word choices
- Suggestions to "improve" correct text
- Tone or formality changes
- Alternative phrasings that are also correct

📋 For EACH **REAL ERROR** found:
{
  "index": <number>,
  "severity": "high" | "medium" | "low",
  "issue": "Spelling error: 'recieve' should be 'receive'",
  "suggestion": "Fix the spelling mistake",
  "betterText": "<corrected text>"
}

🎯 OUTPUT FORMAT:
Return ONLY a valid JSON array:
- If NO errors: []
- If errors found: [{"index": 0, "severity": "high", ...}, ...]

💡 REMEMBER: 
- Empty array [] means text is CORRECT - this is NORMAL!
- Most texts are fine - don't create fake problems
- Only report ACTUAL errors you can prove are wrong`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text().trim();
    
    console.log('AI Quality Check Response:', text.substring(0, 500));
    
    // Parse JSON response
    let jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonMatch = jsonMatch[1].match(/\[[\s\S]*\]/);
      }
    }
    
    if (jsonMatch) {
      const issues = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      const validIssues = issues.filter(issue => 
        typeof issue.index === 'number' &&
        issue.severity &&
        issue.issue &&
        issue.suggestion &&
        issue.betterText
      );
      
      if (validIssues.length === 0) {
        console.log(`✓ Quality check PASSED: All ${sourceTexts.length} texts are correct`);
      } else {
        console.log(`⚠ Quality check: ${validIssues.length} errors found out of ${sourceTexts.length} texts`);
      }
      
      return validIssues;
    }
    
    // If no JSON found, assume no issues
    console.log(`✓ Quality check PASSED: No errors found`);
    return [];
  } catch (error) {
    console.error('Quality check error:', error);
    return [];
  }
}

// Helper: Get language name from code
function getLanguageName(code) {
  const languages = {
    'en': 'English',
    'es': 'Spanish (Español)',
    'fr': 'French (Français)',
    'de': 'German (Deutsch)',
    'it': 'Italian (Italiano)',
    'pt': 'Portuguese (Português)',
    'ru': 'Russian (Русский)',
    'ja': 'Japanese (日本語)',
    'ko': 'Korean (한국어)',
    'zh': 'Chinese Simplified (简体中文)',
    'zh-CN': 'Chinese Simplified (简体中文)',
    'zh-TW': 'Chinese Traditional (繁體中文)',
    'ar': 'Arabic (العربية)',
    'hi': 'Hindi (हिन्दी)',
    'vi': 'Vietnamese (Tiếng Việt)',
    'th': 'Thai (ไทย)',
    'tr': 'Turkish (Türkçe)',
    'pl': 'Polish (Polski)',
    'nl': 'Dutch (Nederlands)',
    'sv': 'Swedish (Svenska)',
    'da': 'Danish (Dansk)',
    'fi': 'Finnish (Suomi)',
    'no': 'Norwegian (Norsk)',
    'cs': 'Czech (Čeština)',
    'hu': 'Hungarian (Magyar)',
    'ro': 'Romanian (Română)',
    'uk': 'Ukrainian (Українська)',
    'el': 'Greek (Ελληνικά)',
    'he': 'Hebrew (עברית)',
    'id': 'Indonesian (Bahasa Indonesia)',
    'ms': 'Malay (Bahasa Melayu)',
    'auto': 'Auto-detect'
  };
  return languages[code] || code.toUpperCase();
}

// Helper: Get translation examples for target language
function getTranslationExamples(targetLang) {
  const examples = {
    'es': `- "Login" → "Iniciar sesión"
- "Submit" → "Enviar"
- "Cancel" → "Cancelar"
- "Save" → "Guardar"
- "Delete" → "Eliminar"
- "Edit" → "Editar"
- "Search" → "Buscar"
- "Welcome" → "Bienvenido"
- "Learn more" → "Más información"`,
    'fr': `- "Login" → "Connexion"
- "Submit" → "Soumettre"
- "Cancel" → "Annuler"
- "Save" → "Enregistrer"
- "Delete" → "Supprimer"
- "Edit" → "Modifier"
- "Search" → "Rechercher"
- "Welcome" → "Bienvenue"
- "Learn more" → "En savoir plus"`,
    'de': `- "Login" → "Anmelden"
- "Submit" → "Absenden"
- "Cancel" → "Abbrechen"
- "Save" → "Speichern"
- "Delete" → "Löschen"
- "Edit" → "Bearbeiten"
- "Search" → "Suchen"
- "Welcome" → "Willkommen"
- "Learn more" → "Mehr erfahren"`,
    'vi': `- "Login" → "Đăng nhập"
- "Submit" → "Gửi"
- "Cancel" → "Hủy"
- "Save" → "Lưu"
- "Delete" → "Xóa"
- "Edit" → "Sửa"
- "Search" → "Tìm kiếm"
- "Welcome" → "Chào mừng"
- "Learn more" → "Tìm hiểu thêm"`,
    'ja': `- "Login" → "ログイン"
- "Submit" → "送信"
- "Cancel" → "キャンセル"
- "Save" → "保存"
- "Delete" → "削除"
- "Edit" → "編集"
- "Search" → "検索"
- "Welcome" → "ようこそ"
- "Learn more" → "詳細を見る"`,
    'zh': `- "Login" → "登录"
- "Submit" → "提交"
- "Cancel" → "取消"
- "Save" → "保存"
- "Delete" → "删除"
- "Edit" → "编辑"
- "Search" → "搜索"
- "Welcome" → "欢迎"
- "Learn more" → "了解更多"`,
    'ko': `- "Login" → "로그인"
- "Submit" → "제출"
- "Cancel" → "취소"
- "Save" → "저장"
- "Delete" → "삭제"
- "Edit" → "편집"
- "Search" → "검색"
- "Welcome" → "환영합니다"
- "Learn more" → "자세히 알아보기"`
  };
  
  return examples[targetLang] || examples['es']; // Default to Spanish examples
}

async function smartTranslateWithContext(texts, sourceLang, targetLang, glossary = {}) {
  try {
    const { VertexAI } = require('@google-cloud/vertexai');
    const vertexAI = new VertexAI({ 
      project: PROJECT_ID, 
      location: LOCATION 
    });
    
    const model = vertexAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp'
    });

    // Prepare context-aware translation request
    const textList = texts.map((t, i) => 
      `${i}. [${t.element}${t.role ? ` role="${t.role}"` : ''}] "${t.text}"`
    ).join('\n');

    const glossaryText = Object.keys(glossary).length > 0 
      ? `\n\nGlossary (use these exact translations):\n${Object.entries(glossary).map(([k, v]) => `"${k}" → "${v}"`).join('\n')}`
      : '';

    // Determine source language for prompt
    const sourceLanguageText = sourceLang && sourceLang !== 'auto' 
      ? `from ${getLanguageName(sourceLang)} ` 
      : '';
    
    const targetLanguageName = getLanguageName(targetLang);

    const prompt = `You are a professional translator. Your task is to translate UI text ${sourceLanguageText}to ${targetLanguageName}.

SOURCE LANGUAGE: ${sourceLang || 'auto-detect'}
TARGET LANGUAGE: ${targetLang}

UI ELEMENTS TO TRANSLATE:
${textList}${glossaryText}

TRANSLATION RULES:
1. ⚠️ CRITICAL: You MUST translate EVERY text to ${targetLanguageName}. NEVER return the original English text.
2. ⚠️ If a text is already in ${targetLanguageName}, still include it in the output (keep it as-is).
3. Keep translations SHORT and NATURAL for UI context:
   - Buttons: 1-3 words maximum
   - Links: 2-4 words maximum  
   - Labels: 2-5 words maximum
   - Paragraphs: Natural sentences
4. Maintain CONSISTENCY: Same word = same translation throughout
5. Preserve: Numbers, HTML entities, special characters, brand names
6. Use appropriate formality level for UI (semi-formal)

TRANSLATION EXAMPLES FOR ${targetLanguageName}:
${getTranslationExamples(targetLang)}

OUTPUT FORMAT:
Return ONLY a valid JSON array. No markdown, no code blocks, no explanations.
Each object must have: index, original, translated

Example output:
[
  {"index": 0, "original": "Login", "translated": "Iniciar sesión"},
  {"index": 1, "original": "Submit", "translated": "Enviar"},
  {"index": 2, "original": "Welcome", "translated": "Bienvenido"}
]

NOW TRANSLATE ALL ${texts.length} ELEMENTS TO ${targetLanguageName}:`;

    console.log('[SmartTranslate] Translating', texts.length, 'texts from', sourceLang || 'auto', 'to', targetLang);
    console.log('[SmartTranslate] First 3 texts:', texts.slice(0, 3).map(t => t.text));

    const result = await model.generateContent(prompt);
    const response = result.response;
    
    // Get text from response - handle different SDK versions
    let text;
    if (typeof response.text === 'function') {
      text = response.text().trim();
    } else if (response.candidates && response.candidates[0]) {
      // Fallback for different SDK version
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        text = candidate.content.parts.map(part => part.text).join('').trim();
      } else {
        console.error('[SmartTranslate] Unable to extract text from candidate:', JSON.stringify(candidate, null, 2));
        throw new Error('Unable to extract text from AI response');
      }
    } else {
      console.error('[SmartTranslate] Invalid response format:', JSON.stringify(response, null, 2));
      throw new Error('Invalid AI response format');
    }
    
    console.log('[SmartTranslate] AI response length:', text.length);
    console.log('[SmartTranslate] AI response preview:', text.substring(0, 500));
    
    // Parse JSON response
    let jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonMatch = jsonMatch[1].match(/\[[\s\S]*\]/);
      }
    }
    
    if (jsonMatch) {
      const translations = JSON.parse(jsonMatch[0]);
      console.log('[SmartTranslate] Parsed', translations.length, 'translations');
      console.log('[SmartTranslate] First 3 translations:', translations.slice(0, 3));
      
      // Check if AI actually translated (not just returning original)
      const notTranslatedCount = translations.filter(t => {
        const original = texts[t.index]?.text || '';
        return t.translated === original;
      }).length;
      
      const notTranslatedPercent = (notTranslatedCount / translations.length) * 100;
      console.log('[SmartTranslate] Not translated:', notTranslatedCount, '/', translations.length, `(${notTranslatedPercent.toFixed(1)}%)`);
      
      if (notTranslatedPercent > 80) {
        console.warn('[SmartTranslate] AI did not translate (>80% same as original)');
      }
      
      return translations.filter(t => t.translated);
    }
    
    console.error('[SmartTranslate] Failed to parse JSON from AI response');
    
    // Return original texts if AI fails
    return texts.map((text, index) => ({
      index,
      original: text.text || text,
      translated: text.text || text
    }));
  } catch (error) {
    console.error('Smart translate error:', error);
    
    // Return original texts if AI fails
    return texts.map((text, index) => ({
      index,
      original: text.text || text,
      translated: text.text || text
    }));
  }
}



async function verifyGoogleToken(token) {
  try {
    // Call Google's tokeninfo endpoint to verify token
    // We only need email for verification, client gets picture directly from Google
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
    
    if (!response.ok) {
      console.error('Failed to verify token, status:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('[verifyGoogleToken] Token verified for:', data.email);
    
    // Verify token is valid
    if (!data.email || !data.email_verified) {
      console.error('[verifyGoogleToken] Email not verified');
      return null;
    }

    return {
      email: data.email
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

async function getUserByApiKey(apiKey) {
  try {
    // Test API key for development (from env variable)
    if (TEST_PREMIUM_KEY && apiKey === TEST_PREMIUM_KEY) {
      return {
        apiKey: apiKey,
        email: 'test@localizeai.com',
        isPremium: true,
        subscriptionEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      };
    }
    
    // Search by API key in all user documents
    const snapshot = await db.collection('users')
      .where('apiKey', '==', apiKey)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data();
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}



async function incrementUsage(apiKey, usageType) {
  try {
    // Find user by API key
    const snapshot = await db.collection('users')
      .where('apiKey', '==', apiKey)
      .limit(1)
      .get();
    
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({
        lastUsed: Firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Increment usage error:', error);
  }
}

// ⚠️ DEPRECATED: Translation usage tracking removed (translation is now free and unlimited)
// This function is kept for backward compatibility only
async function incrementTranslationUsage(email) {
  // No-op: Translation is now free and unlimited via client-side API
  console.log('[DEPRECATED] incrementTranslationUsage called for:', email);
}

// Get usage stats for a user
app.get('/api/usage/stats', async (req, res) => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await getUserByApiKey(apiKey);
    if (!user) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Translation is now free and unlimited via client-side API
    res.json({
      isPremium: user.isPremium || false,
      usageCount: 0, // Always 0 - translation is unlimited
      limit: Infinity, // No limit
      remaining: Infinity, // Unlimited
      hasReachedLimit: false, // Never reached
      message: 'Translation is now free and unlimited via client-side API'
    });
  } catch (error) {
    console.error('Get usage stats error:', error);
    res.status(500).json({ error: 'Failed to get usage stats' });
  }
});

function generateApiKey() {
  return `lzai_${crypto.randomBytes(32).toString('base64url')}`;
}

function createLemonSqueezyCheckout(email = '') {
  // Method 1: Custom domain with checkout UUID (RECOMMENDED - works with custom domains)
  const customDomain = process.env.LEMON_SQUEEZY_CUSTOM_DOMAIN;
  const checkoutUuid = process.env.LEMON_SQUEEZY_CHECKOUT_UUID;
  
  if (customDomain && checkoutUuid) {
    console.log(`Creating checkout URL with custom domain: ${customDomain}`);
    const baseUrl = `https://${customDomain}/checkout/buy/${checkoutUuid}`;
    
    if (email) {
      return `${baseUrl}?checkout[email]=${encodeURIComponent(email)}`;
    }
    return baseUrl;
  }
  
  // Method 2: Custom domain with variant ID (if no checkout UUID)
  const variantId = process.env.LEMON_SQUEEZY_VARIANT_ID;
  
  if (customDomain && variantId) {
    console.log(`Creating checkout URL with custom domain and variant: ${customDomain}`);
    const baseUrl = `https://${customDomain}/checkout/buy/${variantId}`;
    
    if (email) {
      return `${baseUrl}?checkout[email]=${encodeURIComponent(email)}`;
    }
    return baseUrl;
  }
  
  // Method 3: Default store domain with variant ID (FALLBACK)
  const storeId = process.env.LEMON_SQUEEZY_STORE_ID;
  
  if (storeId && variantId) {
    console.log(`Creating checkout URL with store ID: ${storeId}`);
    const baseUrl = `https://${storeId}.lemonsqueezy.com/checkout/buy/${variantId}`;
    
    if (email) {
      return `${baseUrl}?checkout[email]=${encodeURIComponent(email)}`;
    }
    return baseUrl;
  }
  
  // No configuration found
  console.error('❌ Missing Lemon Squeezy configuration!');
  console.error('Need either:');
  console.error('  - LEMON_SQUEEZY_CUSTOM_DOMAIN + LEMON_SQUEEZY_CHECKOUT_UUID');
  console.error('  OR');
  console.error('  - LEMON_SQUEEZY_CUSTOM_DOMAIN + LEMON_SQUEEZY_VARIANT_ID');
  console.error('  OR');
  console.error('  - LEMON_SQUEEZY_STORE_ID + LEMON_SQUEEZY_VARIANT_ID');
  return null;
}

function verifyWebhookSignature(rawBody, signature) {
  if (!LEMON_SQUEEZY_WEBHOOK_SECRET) {
    console.log('⚠️ No webhook secret configured, skipping signature verification');
    return true;
  }
  if (!signature) {
    console.log('❌ No signature provided in webhook');
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', LEMON_SQUEEZY_WEBHOOK_SECRET);
    const digest = hmac.update(rawBody).digest('hex');

    console.log('🔐 Signature verification:');
    console.log('  Received signature:', signature);
    console.log('  Computed digest:', digest);
    console.log('  Match:', signature === digest);

    // Lemon Squeezy sends signature as hex string, compare directly
    return signature === digest;
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}

async function handleSubscriptionCreated(data) {
  const { attributes } = data;
  const customerEmail = attributes.user_email;
  const subscriptionId = data.id;
  const status = attributes.status;
  const variantId = attributes.variant_id;
  const customerId = attributes.customer_id;
  const orderId = attributes.order_id;

  // Get subscription dates from Lemon Squeezy
  const renewsAt = attributes.renews_at ? new Date(attributes.renews_at) : null;
  const endsAt = attributes.ends_at ? new Date(attributes.ends_at) : null;
  
  // Calculate subscription end date (use renews_at or default to 30 days)
  const subscriptionStart = new Date();
  const subscriptionEnd = renewsAt || endsAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  console.log(`📅 Subscription dates - Start: ${subscriptionStart.toISOString()}, End: ${subscriptionEnd.toISOString()}`);

  // Find user by email (email is document ID)
  const userDoc = await db.collection('users').doc(customerEmail).get();
  
  if (userDoc.exists) {
    // Update existing user - reset usage count when upgrading to premium
    await db.collection('users').doc(customerEmail).update({
      isPremium: true,
      // translationUsageCount removed - translation is now free and unlimited
      'lemonSqueezy.customerId': customerId,
      'lemonSqueezy.subscriptionId': subscriptionId,
      'lemonSqueezy.orderId': orderId,
      'lemonSqueezy.variantId': variantId,
      'lemonSqueezy.status': status,
      subscriptionStartDate: Firestore.Timestamp.fromDate(subscriptionStart),
      subscriptionEndDate: Firestore.Timestamp.fromDate(subscriptionEnd),
      subscriptionCancelledAt: null,
      lastUpdated: Firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Subscription created for existing user: ${customerEmail}`);
  } else {
    // Create new user with subscription
    const apiKey = generateApiKey();
    
    await db.collection('users').doc(customerEmail).set({
      email: customerEmail,
      apiKey,
      isPremium: true,
      // translationUsageCount removed - translation is now free and unlimited
      lemonSqueezy: {
        customerId,
        subscriptionId,
        orderId,
        variantId,
        status
      },
      subscriptionStartDate: Firestore.Timestamp.fromDate(subscriptionStart),
      subscriptionEndDate: Firestore.Timestamp.fromDate(subscriptionEnd),
      subscriptionCancelledAt: null,
      createdAt: Firestore.FieldValue.serverTimestamp(),
      lastLogin: Firestore.FieldValue.serverTimestamp(),
      lastUpdated: Firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Subscription created for new user: ${customerEmail}, API key: ${apiKey}`);
  }
}

async function handleSubscriptionUpdated(data) {
  const subscriptionId = data.id;
  const { attributes } = data;
  const status = attributes.status;
  const customerEmail = attributes.user_email;
  const variantId = attributes.variant_id;
  const customerId = attributes.customer_id;
  const orderId = attributes.order_id;
  
  // Get updated dates
  const renewsAt = attributes.renews_at ? new Date(attributes.renews_at) : null;
  const endsAt = attributes.ends_at ? new Date(attributes.ends_at) : null;
  const createdAt = attributes.created_at ? new Date(attributes.created_at) : new Date();

  console.log(`📥 Subscription Update - ID: ${subscriptionId}, Email: ${customerEmail}, Status: ${status}`);
  console.log(`📅 Dates - Created: ${createdAt.toISOString()}, Renews: ${renewsAt?.toISOString() || 'N/A'}, Ends: ${endsAt?.toISOString() || 'N/A'}`);

  // Try to find user by subscription ID first
  let snapshot = await db.collection('users')
    .where('lemonSqueezy.subscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  // If not found by subscription ID, try to find by email
  if (snapshot.empty && customerEmail) {
    console.log(`🔍 User not found by subscription ID, trying email: ${customerEmail}`);
    const userDoc = await db.collection('users').doc(customerEmail).get();
    
    if (userDoc.exists) {
      // User exists but doesn't have this subscription ID yet
      // This can happen if subscription_created webhook was missed
      console.log(`✅ Found user by email, updating with subscription info`);
      
      const updateData = {
        isPremium: status === 'active',
        translationUsageCount: 0, // Reset usage count for premium users
        'lemonSqueezy.customerId': customerId,
        'lemonSqueezy.subscriptionId': subscriptionId,
        'lemonSqueezy.orderId': orderId,
        'lemonSqueezy.variantId': variantId,
        'lemonSqueezy.status': status,
        subscriptionStartDate: Firestore.Timestamp.fromDate(createdAt),
        subscriptionCancelledAt: null,
        lastUpdated: Firestore.FieldValue.serverTimestamp()
      };
      
      // Set subscription end date
      if (renewsAt) {
        updateData.subscriptionEndDate = Firestore.Timestamp.fromDate(renewsAt);
      } else if (endsAt) {
        updateData.subscriptionEndDate = Firestore.Timestamp.fromDate(endsAt);
      } else {
        // Default to 30 days from creation
        updateData.subscriptionEndDate = Firestore.Timestamp.fromDate(new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000));
      }
      
      await userDoc.ref.update(updateData);
      console.log(`✅ Subscription info added to existing user: ${customerEmail}`);
      return;
    }
  }

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    const userData = doc.data();
    
    // Update subscription info
    const updateData = {
      'lemonSqueezy.status': status,
      'lemonSqueezy.customerId': customerId,
      'lemonSqueezy.orderId': orderId,
      'lemonSqueezy.variantId': variantId,
      lastUpdated: Firestore.FieldValue.serverTimestamp()
    };
    
    // Update premium status based on subscription status
    if (status === 'active') {
      updateData.isPremium = true;
      // translationUsageCount removed - translation is now free and unlimited
    } else if (status === 'expired' || status === 'paused') {
      updateData.isPremium = false;
    }
    
    // Update end date if renewed
    if (renewsAt) {
      updateData.subscriptionEndDate = Firestore.Timestamp.fromDate(renewsAt);
      console.log(`📅 Subscription renewed until: ${renewsAt.toISOString()}`);
    } else if (endsAt) {
      updateData.subscriptionEndDate = Firestore.Timestamp.fromDate(endsAt);
    }
    
    // If status is active and was previously cancelled, clear cancellation
    if (status === 'active' && userData.subscriptionCancelledAt) {
      updateData.subscriptionCancelledAt = null;
      console.log(`✅ Subscription reactivated for: ${doc.id}`);
    }

    await doc.ref.update(updateData);
    console.log(`✅ Subscription updated: ${doc.id}, status: ${status}, premium: ${updateData.isPremium !== undefined ? updateData.isPremium : userData.isPremium}`);
  } else {
    console.log(`⚠️ User not found for subscription: ${subscriptionId}, email: ${customerEmail}`);
  }
}

// User cancelled subscription - but still has access until end date (NO REFUND)
async function handleSubscriptionCancelled(data) {
  const subscriptionId = data.id;
  const { attributes } = data;
  const endsAt = attributes.ends_at ? new Date(attributes.ends_at) : null;

  const snapshot = await db.collection('users')
    .where('lemonSqueezy.subscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    const userData = doc.data();
    
    // User cancelled but keeps access until subscription end date
    const updateData = {
      'lemonSqueezy.status': 'cancelled',
      subscriptionCancelledAt: Firestore.FieldValue.serverTimestamp(),
      lastUpdated: Firestore.FieldValue.serverTimestamp()
    };
    
    // Update end date if provided
    if (endsAt) {
      updateData.subscriptionEndDate = Firestore.Timestamp.fromDate(endsAt);
    }
    
    // Keep isPremium = true until subscription actually expires
    // The subscription_expired event will set isPremium = false
    
    await doc.ref.update(updateData);

    const endDate = endsAt || (userData.subscriptionEndDate?.toDate ? userData.subscriptionEndDate.toDate() : null);
    console.log(`⚠️ Subscription cancelled: ${doc.id} - Access until: ${endDate?.toISOString() || 'unknown'}`);
  }
}

// Subscription expired - remove premium access
async function handleSubscriptionExpired(data) {
  const subscriptionId = data.id;

  const snapshot = await db.collection('users')
    .where('lemonSqueezy.subscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    await doc.ref.update({
      isPremium: false,
      'lemonSqueezy.status': 'expired',
      lastUpdated: Firestore.FieldValue.serverTimestamp()
    });

    console.log(`❌ Subscription expired: ${doc.id} - Premium access removed`);
  }
}

// User resumed a cancelled subscription
async function handleSubscriptionResumed(data) {
  const subscriptionId = data.id;
  const { attributes } = data;
  const renewsAt = attributes.renews_at ? new Date(attributes.renews_at) : null;

  const snapshot = await db.collection('users')
    .where('lemonSqueezy.subscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    
    const updateData = {
      isPremium: true,
      'lemonSqueezy.status': 'active',
      subscriptionCancelledAt: null,
      lastUpdated: Firestore.FieldValue.serverTimestamp()
    };
    
    if (renewsAt) {
      updateData.subscriptionEndDate = Firestore.Timestamp.fromDate(renewsAt);
    }
    
    await doc.ref.update(updateData);

    console.log(`✅ Subscription resumed: ${doc.id}`);
  }
}

// Subscription paused - remove access immediately
async function handleSubscriptionPaused(data) {
  const subscriptionId = data.id;

  const snapshot = await db.collection('users')
    .where('lemonSqueezy.subscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    await doc.ref.update({
      isPremium: false,
      'lemonSqueezy.status': 'paused',
      lastUpdated: Firestore.FieldValue.serverTimestamp()
    });

    console.log(`⏸️ Subscription paused: ${doc.id} - Access removed`);
  }
}

// Subscription unpaused - restore access
async function handleSubscriptionUnpaused(data) {
  const subscriptionId = data.id;
  const { attributes } = data;
  const renewsAt = attributes.renews_at ? new Date(attributes.renews_at) : null;

  const snapshot = await db.collection('users')
    .where('lemonSqueezy.subscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    
    const updateData = {
      isPremium: true,
      'lemonSqueezy.status': 'active',
      lastUpdated: Firestore.FieldValue.serverTimestamp()
    };
    
    if (renewsAt) {
      updateData.subscriptionEndDate = Firestore.Timestamp.fromDate(renewsAt);
    }
    
    await doc.ref.update(updateData);

    console.log(`▶️ Subscription unpaused: ${doc.id} - Access restored`);
  }
}

// Payment failed - mark as past_due but keep access temporarily
async function handleSubscriptionPaymentFailed(data) {
  const subscriptionId = data.id;

  const snapshot = await db.collection('users')
    .where('lemonSqueezy.subscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    await doc.ref.update({
      'lemonSqueezy.status': 'past_due',
      lastUpdated: Firestore.FieldValue.serverTimestamp()
    });

    console.log(`⚠️ Payment failed: ${doc.id} - Status: past_due`);
  }
}

// Payment succeeded - extend subscription
async function handleSubscriptionPaymentSuccess(data) {
  const subscriptionId = data.id;
  const { attributes } = data;
  const renewsAt = attributes.renews_at ? new Date(attributes.renews_at) : null;

  const snapshot = await db.collection('users')
    .where('lemonSqueezy.subscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    
    const updateData = {
      isPremium: true,
      'lemonSqueezy.status': 'active',
      lastUpdated: Firestore.FieldValue.serverTimestamp()
    };
    
    // Extend subscription end date
    if (renewsAt) {
      updateData.subscriptionEndDate = Firestore.Timestamp.fromDate(renewsAt);
      console.log(`💰 Payment success: ${doc.id} - Extended until: ${renewsAt.toISOString()}`);
    } else {
      console.log(`💰 Payment success: ${doc.id}`);
    }
    
    await doc.ref.update(updateData);
  }
}

// Failed payment recovered - restore access
async function handleSubscriptionPaymentRecovered(data) {
  const subscriptionId = data.id;
  const { attributes } = data;
  const renewsAt = attributes.renews_at ? new Date(attributes.renews_at) : null;

  const snapshot = await db.collection('users')
    .where('lemonSqueezy.subscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    
    const updateData = {
      isPremium: true,
      'lemonSqueezy.status': 'active',
      lastUpdated: Firestore.FieldValue.serverTimestamp()
    };
    
    if (renewsAt) {
      updateData.subscriptionEndDate = Firestore.Timestamp.fromDate(renewsAt);
    }
    
    await doc.ref.update(updateData);

    console.log(`✅ Payment recovered: ${doc.id} - Access restored`);
  }
}

// ============================================
// START SERVER
// ============================================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LocalizeAI API running on port ${PORT}`);
  console.log(`📍 Project: ${PROJECT_ID}`);
  console.log(`📍 Location: ${LOCATION}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Server is ready to accept connections`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
