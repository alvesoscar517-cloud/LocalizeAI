// Global Languages Configuration
// Supports 100+ languages with native names and auto-detection

const LANGUAGES_CONFIG = {
  // Major World Languages
  'en': { name: 'English', nativeName: 'English', region: 'Global' },
  'zh': { name: 'Chinese (Simplified)', nativeName: '简体中文', region: 'Asia' },
  'zh-TW': { name: 'Chinese (Traditional)', nativeName: '繁體中文', region: 'Asia' },
  'es': { name: 'Spanish', nativeName: 'Español', region: 'Europe' },
  'hi': { name: 'Hindi', nativeName: 'हिन्दी', region: 'Asia' },
  'ar': { name: 'Arabic', nativeName: 'العربية', region: 'Middle East' },
  'pt': { name: 'Portuguese', nativeName: 'Português', region: 'Europe' },
  'bn': { name: 'Bengali', nativeName: 'বাংলা', region: 'Asia' },
  'ru': { name: 'Russian', nativeName: 'Русский', region: 'Europe' },
  'ja': { name: 'Japanese', nativeName: '日本語', region: 'Asia' },
  'pa': { name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', region: 'Asia' },
  'de': { name: 'German', nativeName: 'Deutsch', region: 'Europe' },
  'jv': { name: 'Javanese', nativeName: 'Basa Jawa', region: 'Asia' },
  'ko': { name: 'Korean', nativeName: '한국어', region: 'Asia' },
  'fr': { name: 'French', nativeName: 'Français', region: 'Europe' },
  'te': { name: 'Telugu', nativeName: 'తెలుగు', region: 'Asia' },
  'mr': { name: 'Marathi', nativeName: 'मराठी', region: 'Asia' },
  'tr': { name: 'Turkish', nativeName: 'Türkçe', region: 'Europe' },
  'ta': { name: 'Tamil', nativeName: 'தமிழ்', region: 'Asia' },
  'vi': { name: 'Vietnamese', nativeName: 'Tiếng Việt', region: 'Asia' },
  'ur': { name: 'Urdu', nativeName: 'اردو', region: 'Asia' },
  'it': { name: 'Italian', nativeName: 'Italiano', region: 'Europe' },
  'th': { name: 'Thai', nativeName: 'ไทย', region: 'Asia' },
  'gu': { name: 'Gujarati', nativeName: 'ગુજરાતી', region: 'Asia' },
  'pl': { name: 'Polish', nativeName: 'Polski', region: 'Europe' },
  'uk': { name: 'Ukrainian', nativeName: 'Українська', region: 'Europe' },
  'ml': { name: 'Malayalam', nativeName: 'മലയാളം', region: 'Asia' },
  'kn': { name: 'Kannada', nativeName: 'ಕನ್ನಡ', region: 'Asia' },
  'or': { name: 'Odia', nativeName: 'ଓଡ଼ିଆ', region: 'Asia' },
  'my': { name: 'Burmese', nativeName: 'မြန်မာဘာသာ', region: 'Asia' },
  
  // European Languages
  'nl': { name: 'Dutch', nativeName: 'Nederlands', region: 'Europe' },
  'ro': { name: 'Romanian', nativeName: 'Română', region: 'Europe' },
  'cs': { name: 'Czech', nativeName: 'Čeština', region: 'Europe' },
  'el': { name: 'Greek', nativeName: 'Ελληνικά', region: 'Europe' },
  'sv': { name: 'Swedish', nativeName: 'Svenska', region: 'Europe' },
  'hu': { name: 'Hungarian', nativeName: 'Magyar', region: 'Europe' },
  'fi': { name: 'Finnish', nativeName: 'Suomi', region: 'Europe' },
  'no': { name: 'Norwegian', nativeName: 'Norsk', region: 'Europe' },
  'da': { name: 'Danish', nativeName: 'Dansk', region: 'Europe' },
  'sk': { name: 'Slovak', nativeName: 'Slovenčina', region: 'Europe' },
  'bg': { name: 'Bulgarian', nativeName: 'Български', region: 'Europe' },
  'hr': { name: 'Croatian', nativeName: 'Hrvatski', region: 'Europe' },
  'sr': { name: 'Serbian', nativeName: 'Српски', region: 'Europe' },
  'lt': { name: 'Lithuanian', nativeName: 'Lietuvių', region: 'Europe' },
  'sl': { name: 'Slovenian', nativeName: 'Slovenščina', region: 'Europe' },
  'lv': { name: 'Latvian', nativeName: 'Latviešu', region: 'Europe' },
  'et': { name: 'Estonian', nativeName: 'Eesti', region: 'Europe' },
  'is': { name: 'Icelandic', nativeName: 'Íslenska', region: 'Europe' },
  'ga': { name: 'Irish', nativeName: 'Gaeilge', region: 'Europe' },
  'cy': { name: 'Welsh', nativeName: 'Cymraeg', region: 'Europe' },
  'sq': { name: 'Albanian', nativeName: 'Shqip', region: 'Europe' },
  'mk': { name: 'Macedonian', nativeName: 'Македонски', region: 'Europe' },
  'bs': { name: 'Bosnian', nativeName: 'Bosanski', region: 'Europe' },
  'mt': { name: 'Maltese', nativeName: 'Malti', region: 'Europe' },
  
  // Asian Languages
  'id': { name: 'Indonesian', nativeName: 'Bahasa Indonesia', region: 'Asia' },
  'ms': { name: 'Malay', nativeName: 'Bahasa Melayu', region: 'Asia' },
  'tl': { name: 'Filipino', nativeName: 'Filipino', region: 'Asia' },
  'lo': { name: 'Lao', nativeName: 'ລາວ', region: 'Asia' },
  'km': { name: 'Khmer', nativeName: 'ខ្មែរ', region: 'Asia' },
  'si': { name: 'Sinhala', nativeName: 'සිංහල', region: 'Asia' },
  'ne': { name: 'Nepali', nativeName: 'नेपाली', region: 'Asia' },
  'mn': { name: 'Mongolian', nativeName: 'Монгол', region: 'Asia' },
  'ka': { name: 'Georgian', nativeName: 'ქართული', region: 'Asia' },
  'hy': { name: 'Armenian', nativeName: 'Հայերեն', region: 'Asia' },
  'az': { name: 'Azerbaijani', nativeName: 'Azərbaycan', region: 'Asia' },
  'kk': { name: 'Kazakh', nativeName: 'Қазақ', region: 'Asia' },
  'uz': { name: 'Uzbek', nativeName: 'Oʻzbek', region: 'Asia' },
  'ky': { name: 'Kyrgyz', nativeName: 'Кыргызча', region: 'Asia' },
  'tg': { name: 'Tajik', nativeName: 'Тоҷикӣ', region: 'Asia' },
  'ps': { name: 'Pashto', nativeName: 'پښتو', region: 'Asia' },
  'sd': { name: 'Sindhi', nativeName: 'سنڌي', region: 'Asia' },
  
  // Middle Eastern & African Languages
  'he': { name: 'Hebrew', nativeName: 'עברית', region: 'Middle East' },
  'fa': { name: 'Persian', nativeName: 'فارسی', region: 'Middle East' },
  'ku': { name: 'Kurdish', nativeName: 'Kurdî', region: 'Middle East' },
  'am': { name: 'Amharic', nativeName: 'አማርኛ', region: 'Africa' },
  'sw': { name: 'Swahili', nativeName: 'Kiswahili', region: 'Africa' },
  'zu': { name: 'Zulu', nativeName: 'isiZulu', region: 'Africa' },
  'xh': { name: 'Xhosa', nativeName: 'isiXhosa', region: 'Africa' },
  'af': { name: 'Afrikaans', nativeName: 'Afrikaans', region: 'Africa' },
  'so': { name: 'Somali', nativeName: 'Soomaali', region: 'Africa' },
  'ha': { name: 'Hausa', nativeName: 'Hausa', region: 'Africa' },
  'yo': { name: 'Yoruba', nativeName: 'Yorùbá', region: 'Africa' },
  'ig': { name: 'Igbo', nativeName: 'Igbo', region: 'Africa' },
  
  // Americas
  'pt-BR': { name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', region: 'Americas' },
  'es-MX': { name: 'Spanish (Mexico)', nativeName: 'Español (México)', region: 'Americas' },
  'es-AR': { name: 'Spanish (Argentina)', nativeName: 'Español (Argentina)', region: 'Americas' },
  'fr-CA': { name: 'French (Canada)', nativeName: 'Français (Canada)', region: 'Americas' },
  'ht': { name: 'Haitian Creole', nativeName: 'Kreyòl Ayisyen', region: 'Americas' },
  'qu': { name: 'Quechua', nativeName: 'Runa Simi', region: 'Americas' },
  'gn': { name: 'Guarani', nativeName: 'Avañe\'ẽ', region: 'Americas' },
  
  // Additional Popular Languages
  'la': { name: 'Latin', nativeName: 'Latina', region: 'Historical' },
  'eo': { name: 'Esperanto', nativeName: 'Esperanto', region: 'Constructed' },
  'yi': { name: 'Yiddish', nativeName: 'ייִדיש', region: 'Europe' },
  'eu': { name: 'Basque', nativeName: 'Euskara', region: 'Europe' },
  'ca': { name: 'Catalan', nativeName: 'Català', region: 'Europe' },
  'gl': { name: 'Galician', nativeName: 'Galego', region: 'Europe' },
  'lb': { name: 'Luxembourgish', nativeName: 'Lëtzebuergesch', region: 'Europe' }
};

// Smart language detection and defaults
const LanguageHelper = {
  // Detect browser language
  detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0].toLowerCase();
    
    // Check if exact match exists
    if (LANGUAGES_CONFIG[browserLang]) {
      return browserLang;
    }
    
    // Check if base language exists
    if (LANGUAGES_CONFIG[langCode]) {
      return langCode;
    }
    
    // Default to English
    return 'en';
  },

  // Detect page language from HTML attributes
  detectPageLanguage() {
    // Try multiple sources in order of reliability
    
    // 1. Check html lang attribute
    const htmlLang = document.documentElement.lang;
    if (htmlLang) {
      const langCode = htmlLang.split('-')[0].toLowerCase();
      if (LANGUAGES_CONFIG[htmlLang]) {
        return htmlLang;
      }
      if (LANGUAGES_CONFIG[langCode]) {
        return langCode;
      }
    }
    
    // 2. Check meta content-language
    const metaLang = document.querySelector('meta[http-equiv="content-language"]');
    if (metaLang) {
      const langCode = metaLang.content.split('-')[0].toLowerCase();
      if (LANGUAGES_CONFIG[metaLang.content]) {
        return metaLang.content;
      }
      if (LANGUAGES_CONFIG[langCode]) {
        return langCode;
      }
    }
    
    // 3. Check og:locale meta tag
    const ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) {
      const langCode = ogLocale.content.split('_')[0].toLowerCase();
      if (LANGUAGES_CONFIG[langCode]) {
        return langCode;
      }
    }
    
    // 4. Default to English if nothing detected
    return 'en';
  },

  // Get smart target language based on source
  getSmartTargetLanguage(sourceLang) {
    const browserLang = this.detectBrowserLanguage();
    
    // If source is browser language, suggest English
    if (sourceLang === browserLang) {
      return 'en';
    }
    
    // If source is English, suggest browser language
    if (sourceLang === 'en') {
      return browserLang;
    }
    
    // Otherwise suggest browser language
    return browserLang;
  },

  // Get language display name
  getLanguageName(code, showNative = true) {
    const lang = LANGUAGES_CONFIG[code];
    if (!lang) return code;
    
    if (showNative && lang.nativeName !== lang.name) {
      return `${lang.nativeName} (${lang.name})`;
    }
    return lang.nativeName;
  },

  // Search languages
  searchLanguages(query) {
    if (!query) return Object.keys(LANGUAGES_CONFIG);
    
    const lowerQuery = query.toLowerCase();
    return Object.entries(LANGUAGES_CONFIG)
      .filter(([code, lang]) => 
        code.toLowerCase().includes(lowerQuery) ||
        lang.name.toLowerCase().includes(lowerQuery) ||
        lang.nativeName.toLowerCase().includes(lowerQuery)
      )
      .map(([code]) => code);
  },

  // Get popular languages (top 30)
  getPopularLanguages() {
    return [
      'en', 'zh', 'es', 'hi', 'ar', 'pt', 'bn', 'ru', 'ja', 'pa',
      'de', 'jv', 'ko', 'fr', 'te', 'mr', 'tr', 'ta', 'vi', 'ur',
      'it', 'th', 'gu', 'pl', 'uk', 'nl', 'id', 'ms', 'tl', 'fa'
    ];
  },

  // Get all languages sorted by region
  getLanguagesByRegion() {
    const byRegion = {};
    
    Object.entries(LANGUAGES_CONFIG).forEach(([code, lang]) => {
      if (!byRegion[lang.region]) {
        byRegion[lang.region] = [];
      }
      byRegion[lang.region].push({ code, ...lang });
    });
    
    return byRegion;
  },

  // Get all language codes
  getAllLanguageCodes() {
    return Object.keys(LANGUAGES_CONFIG);
  },

  // Validate language code
  isValidLanguage(code) {
    return !!LANGUAGES_CONFIG[code];
  }
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.LANGUAGES_CONFIG = LANGUAGES_CONFIG;
  window.LanguageHelper = LanguageHelper;
}
