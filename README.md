# LocalizeAI - AI Translation Testing Chrome Extension

[![Version](https://img.shields.io/badge/version-2.0.1-blue.svg)](https://github.com/alvesoscar517-cloud/LocalizeAI)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-orange.svg)](https://chrome.google.com/webstore)

> Professional AI-powered localization testing tool for developers, QA engineers, and translators. Test translations, report bugs, and ensure perfect internationalization across 100+ languages.

## 🌟 Overview

LocalizeAI is a comprehensive Chrome extension designed to streamline the localization testing workflow. It provides real-time translation testing, bug reporting, pseudo-localization, and AI-powered quality checks - all within your browser.

**Perfect for:**
- 🧑‍💻 Frontend Developers testing i18n implementations
- 🔍 QA Engineers validating translations
- 🌐 Localization Managers reviewing content
- 📝 Translators checking context and quality
- 👨‍💼 Product Managers ensuring global readiness

## ✨ Key Features

### 🔄 Live Translation Testing
- **Instant Toggle**: Switch between original and translated text with one click
- **100+ Languages**: Support for all major world languages
- **Smart Caching**: Fast switching with intelligent translation memory
- **Auto-Detection**: Automatically detects page and browser language
- **Client-Side Translation**: Free, unlimited translations using Google Translate API

### 🐛 Bug Report Management
- **Visual Bug Tracking**: Click any text element to report issues
- **Rich Context Capture**: Automatically captures element details, XPath, HTML, and screenshots
- **Categorization**: Organize by type (translation, overflow, layout, missing, formatting)
- **Severity Levels**: Mark issues as high, medium, or low priority
- **Export Options**: Export to Excel, JSON, or sync with Google Drive
- **Local Storage**: All reports stored in IndexedDB for privacy and offline access

### 🎨 Pseudo-Localization
- **Text Expansion Testing**: Simulates 30-40% text length increase
- **Character Substitution**: Replaces with accented characters (ā, ē, ī, ō, ū)
- **Visual Markers**: Wraps text in `[!!!...!!!]` for easy identification
- **Overflow Detection**: Quickly identify UI elements that break with longer text
- **Example**: "Settings" → "[!!! Şḗŧŧīƞɠş·· !!!]"

### ✏️ Live Edit Mode
- **Direct Editing**: Click any text on the page to edit in-place
- **Change Tracking**: All edits are tracked and can be exported
- **Export Formats**: Save changes as JSON or Excel
- **Link Protection**: Automatically blocks navigation during editing
- **Keyboard Shortcut**: Press `Ctrl+E` to export changes

### 🤖 AI-Powered Features (Premium)
- **AI Suggestions**: Get context-aware translation improvements
- **Quality Check**: Automated grammar, spelling, and formatting validation
- **Smart Batch Translation**: Translate entire pages with AI context awareness
- **Natural Phrasing**: Better translations for UI/UX text
- **Powered by**: Google Vertex AI (Gemini 2.0 Flash)

### 📄 JSON File Translator
- **Bulk Translation**: Translate entire JSON language files
- **Multi-Language**: Select multiple target languages at once
- **Two Modes**: 
  - Google Translate (Free, fast, 100+ languages)
  - AI Translation (Premium, context-aware, natural phrasing)
- **Format Preservation**: Maintains JSON structure and placeholders
- **Placeholder Protection**: Never translates `$VARIABLE$`, `{placeholder}`, `%s`, etc.
- **Download All**: Batch download all translated files

### 🔐 Authentication & Subscription
- **Google Sign-In**: Secure OAuth2 authentication
- **Free Tier**: Basic translation features with Google Translate
- **Premium Tier**: Unlimited AI features, quality checks, and priority support
- **Subscription Management**: Powered by Lemon Squeezy

## 🚀 Installation

### From Chrome Web Store (Recommended)
1. Visit [LocalizeAI on Chrome Web Store](#) (link coming soon)
2. Click "Add to Chrome"
3. Pin the extension to your toolbar

### From Source (Development)
```bash
# Clone the repository
git clone https://github.com/alvesoscar517-cloud/LocalizeAI.git
cd LocalizeAI

# Install dependencies
npm install

# Build the extension
npm run build

# Load in Chrome
1. Open chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the project folder
```

## 📖 Usage Guide

### Basic Translation Testing

1. **Open Side Panel**: Click the LocalizeAI icon in your toolbar
2. **Select Languages**: Choose source and target languages (auto-detected by default)
3. **Translate**: Click "Translated" to see the page in your target language
4. **Toggle Back**: Click "Original" to restore original text
5. **Clear Cache**: Use "Clear Cache & Retranslate" to refresh translations

### Reporting Bugs

1. **Enable Bug Report Mode**: Click "Start Reporting" in the side panel
2. **Click Elements**: Click any text element on the page to report an issue
3. **Fill Details**: 
   - Select issue type (translation, overflow, layout, etc.)
   - Choose severity (high, medium, low)
   - Add description
4. **Save Report**: Report is automatically saved to local IndexedDB
5. **Manage Reports**: Click "Manage Reports" to view, edit, export, or sync

### Using Pseudo-Localization

1. Click "Apply Pseudo-Loc" in the side panel
2. All text on the page will be transformed with:
   - Accented characters
   - 30-40% length expansion
   - Visual markers `[!!!...!!!]`
3. Identify UI elements that break or overflow
4. Click "Remove Pseudo-Loc" to restore original text

### Live Editing

1. Click "Enable Live Edit" in the side panel
2. Click any text element to edit it directly
3. Make your changes
4. Press `Ctrl+E` or click "Disable Live Edit" to export changes
5. Choose export format (JSON or Excel)

### AI Features (Premium)

#### AI Suggestions
1. Select any text on the page
2. Click "Get AI Suggestions"
3. Review context-aware alternatives
4. Click to apply the best suggestion

#### Quality Check
1. Click "Check Translation Quality"
2. AI scans all text for:
   - Grammar errors
   - Spelling mistakes
   - Formatting issues
   - Unnatural phrasing
3. Review and apply suggested fixes

#### Smart Batch Translate
1. Click "Smart Batch Translate"
2. AI translates entire page with context awareness
3. Progress indicator shows real-time status
4. Results are cached for fast switching

### JSON File Translation

1. Click "Translate JSON File" in the side panel
2. **Upload**: Drag & drop or browse for your JSON file (e.g., `en.json`)
3. **Select Languages**: Choose one or more target languages
4. **Choose Mode**: 
   - Google Translate (Free, fast)
   - AI Translation (Premium, better quality)
5. **Translate**: Click "Start Translation"
6. **Download**: Download individual files or all at once

## 🏗️ Architecture

### Frontend (Chrome Extension)
```
LocalizeAI/
├── manifest.json              # Extension configuration
├── background.js              # Service worker (auth, API calls)
├── content.js                 # Main content script (5625 lines)
├── panel.html/js              # Side panel UI
├── popup.html/js              # Extension popup
├── translate-client.js        # Client-side translation (free)
├── json-translator.js         # JSON file translator
├── bug-report-db.js           # IndexedDB manager
├── bug-report-manager.js      # Bug report UI
├── bug-report-sidebar.js      # Bug report sidebar
├── bug-report-export.js       # Export functionality
├── drive-sync.js              # Google Drive sync
├── languages-config.js        # 100+ language definitions
├── i18n-helper.js             # Internationalization helper
├── text-shimmer.js            # Loading animations
├── confirm-dialog.js          # Confirmation dialogs
├── content.css                # Styles
├── _locales/                  # Extension translations (100+ languages)
│   ├── en/messages.json
│   ├── vi/messages.json
│   └── ...
└── icons/                     # Extension icons
```

### Backend (Node.js + Google Cloud)
```
backend/
├── index.js                   # Express API server (2298 lines)
├── package.json               # Dependencies
└── .env                       # Environment variables

Endpoints:
- POST /api/auth/google        # Google OAuth authentication
- POST /api/translate-json-ai  # AI JSON translation (Premium)
- POST /api/ai-suggest         # AI suggestions (Premium)
- POST /api/quality-check      # Quality check (Premium)
- POST /api/smart-translate    # Smart batch translate (Premium)
- GET  /api/subscription/status # Check subscription status
- POST /webhook/lemon-squeezy  # Payment webhooks
```

### Technology Stack

**Frontend:**
- Vanilla JavaScript (ES6+)
- Chrome Extension APIs (Manifest V3)
- IndexedDB for local storage
- Google Translate API (client-side, free)
- Lottie animations
- SheetJS (XLSX) for Excel export

**Backend:**
- Node.js + Express
- Google Cloud Platform:
  - Cloud Run (serverless deployment)
  - Firestore (user data & subscriptions)
  - Vertex AI (Gemini 2.0 Flash for AI features)
  - OAuth2 (authentication)
- Lemon Squeezy (payment processing)
- Nodemailer (email notifications)

## 🔧 Configuration

### Environment Variables (Backend)

```bash
# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
VERTEX_AI_LOCATION=us-central1

# Lemon Squeezy (Payment)
LEMON_SQUEEZY_STORE_ID=your-store-id
LEMON_SQUEEZY_VARIANT_ID=your-variant-id
LEMON_SQUEEZY_WEBHOOK_SECRET=your-webhook-secret

# Email (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
SUPPORT_EMAIL=support@yourdomain.com

# Optional
TEST_PREMIUM_KEY=test-key-for-development
CRON_SECRET=secret-for-cron-jobs
```

### OAuth2 Configuration (manifest.json)

```json
{
  "oauth2": {
    "client_id": "your-client-id.apps.googleusercontent.com",
    "scopes": [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive.file"
    ]
  }
}
```

## 🚢 Deployment

### Backend Deployment (Google Cloud Run)

```bash
# Navigate to backend directory
cd backend

# Deploy to Cloud Run
npm run deploy

# Or manually:
gcloud run deploy localizeai-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=your-project-id
```

### Extension Packaging

```bash
# Build and create ZIP for Chrome Web Store
npm run build
npm run zip

# Output: localizeai-extension.zip
```

## 📊 Database Schema

### Firestore Collections

#### `users` Collection
```javascript
{
  email: "user@example.com",           // Document ID
  apiKey: "generated-api-key",
  isPremium: false,
  createdAt: Timestamp,
  lastLogin: Timestamp,
  lemonSqueezy: {
    customerId: "cus_xxx",
    subscriptionId: "sub_xxx",
    orderId: "ord_xxx",
    variantId: "var_xxx",
    status: "active" | "cancelled" | "expired"
  },
  subscriptionStartDate: Timestamp,
  subscriptionEndDate: Timestamp,
  subscriptionCancelledAt: Timestamp
}
```

### IndexedDB (Client-Side)

#### `LocalizeAI_BugReports` Database
```javascript
{
  id: 1,                                // Auto-increment
  timestamp: 1704067200000,
  status: "open" | "resolved",
  severity: "high" | "medium" | "low",
  category: "translation" | "overflow" | "layout" | "missing" | "formatting" | "other",
  notes: "User description",
  url: "https://example.com/page",
  pageTitle: "Page Title",
  viewport: { width: 1920, height: 1080 },
  element: {
    tag: "button",
    text: "Submit",
    selector: "#submit-btn",
    xpath: "/html/body/div[1]/button",
    html: "<button>Submit</button>"
  },
  translation: {
    original: "Submit",
    translated: "Enviar",
    sourceLang: "en",
    targetLang: "es"
  }
}
```

## 🔒 Security & Privacy

- **Local-First**: All bug reports stored locally in IndexedDB
- **No Data Collection**: Translation happens client-side (free tier)
- **Secure Auth**: Google OAuth2 with token refresh
- **HTTPS Only**: All API calls use HTTPS
- **Minimal Permissions**: Only requests necessary Chrome permissions
- **Optional Sync**: Google Drive sync is opt-in only

## 🌍 Supported Languages

100+ languages including:

**Major Languages:**
English, Chinese (Simplified/Traditional), Spanish, Hindi, Arabic, Portuguese, Bengali, Russian, Japanese, Korean, French, German, Italian, Vietnamese, Thai, Turkish, Polish, Ukrainian, Dutch, Indonesian, and more.

**Regional Variants:**
- Spanish: Spain, Mexico, Argentina
- Portuguese: Portugal, Brazil
- French: France, Canada
- Chinese: Simplified, Traditional

See `languages-config.js` for the complete list.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Install dependencies
npm install

# Run backend locally
cd backend
npm run dev

# Load extension in Chrome
1. Open chrome://extensions/
2. Enable Developer mode
3. Load unpacked extension
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Oscar Alves**
- GitHub: [@alvesoscar517-cloud](https://github.com/alvesoscar517-cloud)
- Email: alvesoscar517@gmail.com

## 🙏 Acknowledgments

- Google Cloud Platform for Vertex AI and infrastructure
- Google Translate API for free client-side translations
- Lemon Squeezy for payment processing
- Lucide Icons for beautiful UI icons
- Lottie for smooth animations
- SheetJS for Excel export functionality

## 📞 Support

- **Email**: localizeai.care@gmail.com
- **Issues**: [GitHub Issues](https://github.com/alvesoscar517-cloud/LocalizeAI/issues)
- **Documentation**: [Wiki](https://github.com/alvesoscar517-cloud/LocalizeAI/wiki)

## 🗺️ Roadmap

- [ ] Firefox extension support
- [ ] Edge extension support
- [ ] Figma plugin integration
- [ ] VS Code extension
- [ ] API for CI/CD integration
- [ ] Team collaboration features
- [ ] Advanced analytics dashboard
- [ ] Custom glossary management
- [ ] Translation memory sharing

## 📈 Stats

- **Lines of Code**: ~15,000+
- **Languages Supported**: 100+
- **Features**: 10+ major features
- **API Endpoints**: 8
- **Database Collections**: 1 (Firestore) + 1 (IndexedDB)

---

**Made with ❤️ for the localization community**

⭐ Star this repo if you find it useful!
