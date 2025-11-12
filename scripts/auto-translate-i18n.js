// Auto-translate new i18n keys to all languages using Google Translate
const fs = require('fs');
const path = require('path');
const https = require('https');

// New keys to translate (English source)
const newKeys = {
  "checkedLabel": "Checked:",
  "spelling": "Spelling",
  "grammar": "Grammar",
  "formatting": "Formatting",
  "noIssuesInOriginalText": "Original text has no issues",
  "checkedTextsWithCount": "Checked <strong>$COUNT$</strong> text segments",
  "foundErrorsCount": "Found <strong>$COUNT$</strong> errors to fix",
  "noErrors": "No errors!",
  "qualityCheckReport": "Quality Check Report"
};

// Language code mapping (Chrome extension locale to Google Translate)
const langMap = {
  'en': 'en', 'vi': 'vi', 'es': 'es', 'fr': 'fr', 'de': 'de', 'it': 'it',
  'pt': 'pt', 'pt-BR': 'pt', 'ru': 'ru', 'ja': 'ja', 'ko': 'ko', 'zh': 'zh-CN',
  'zh-TW': 'zh-TW', 'ar': 'ar', 'hi': 'hi', 'bn': 'bn', 'tr': 'tr', 'nl': 'nl',
  'pl': 'pl', 'th': 'th', 'sv': 'sv', 'da': 'da', 'fi': 'fi', 'no': 'no',
  'cs': 'cs', 'hu': 'hu', 'ro': 'ro', 'uk': 'uk', 'el': 'el', 'he': 'he',
  'id': 'id', 'ms': 'ms', 'fa': 'fa', 'ur': 'ur', 'sw': 'sw', 'af': 'af'
};

// Function to translate text using Google Translate API
async function translateText(text, targetLang) {
  // Remove HTML tags for translation
  const cleanText = text.replace(/<[^>]*>/g, '');
  
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      client: 'gtx',
      sl: 'en',
      tl: targetLang,
      dt: 't',
      q: cleanText
    });

    const url = `https://translate.googleapis.com/translate_a/single?${params}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed[0] && parsed[0][0] && parsed[0][0][0]) {
            let translated = parsed[0][0][0];
            // Restore HTML tags if present in original
            if (text.includes('<strong>')) {
              translated = translated.replace(/\$COUNT\$/g, '<strong>$COUNT$</strong>');
              translated = translated.replace(/<strong>\s*<strong>/g, '<strong>');
              translated = translated.replace(/<\/strong>\s*<\/strong>/g, '</strong>');
            }
            resolve(translated);
          } else {
            resolve(text); // Fallback to original
          }
        } catch (e) {
          resolve(text); // Fallback to original
        }
      });
    }).on('error', () => {
      resolve(text); // Fallback to original on error
    });
  });
}

// Delay function to avoid rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function
async function translateAllLanguages() {
  const localesDir = path.join(__dirname, '..', '_locales');
  const languages = fs.readdirSync(localesDir).filter(dir => {
    const stat = fs.statSync(path.join(localesDir, dir));
    return stat.isDirectory() && dir !== 'en' && dir !== 'vi';
  });

  console.log(`Translating to ${languages.length} languages...`);

  for (const lang of languages) {
    const messagesPath = path.join(localesDir, lang, 'messages.json');
    
    if (!fs.existsSync(messagesPath)) continue;

    try {
      const content = fs.readFileSync(messagesPath, 'utf8');
      const messages = JSON.parse(content);
      
      const targetLang = langMap[lang] || lang;
      let updated = false;

      for (const [key, englishText] of Object.entries(newKeys)) {
        if (messages[key] && messages[key].message === englishText) {
          // Translate
          const translated = await translateText(englishText, targetLang);
          messages[key].message = translated;
          updated = true;
          
          // Small delay to avoid rate limiting
          await delay(100);
        }
      }

      if (updated) {
        fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2), 'utf8');
        console.log(`✓ Translated ${lang}`);
      }
    } catch (error) {
      console.error(`✗ Error with ${lang}:`, error.message);
    }
  }

  console.log('\nTranslation complete!');
}

// Run
translateAllLanguages().catch(console.error);
