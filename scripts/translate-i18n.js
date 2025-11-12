// Script to translate new i18n keys to all languages
const fs = require('fs');
const path = require('path');

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

// Vietnamese translations (reference)
const viTranslations = {
  "checkedLabel": "Đã kiểm tra:",
  "spelling": "Chính tả",
  "grammar": "Ngữ pháp",
  "formatting": "Định dạng",
  "noIssuesInOriginalText": "Văn bản gốc không có vấn đề gì",
  "checkedTextsWithCount": "Đã kiểm tra <strong>$COUNT$</strong> đoạn văn bản",
  "foundErrorsCount": "Tìm thấy <strong>$COUNT$</strong> lỗi cần sửa",
  "noErrors": "Không có lỗi!",
  "qualityCheckReport": "Báo cáo kiểm tra chất lượng"
};

// Get all language directories
const localesDir = path.join(__dirname, '..', '_locales');
const languages = fs.readdirSync(localesDir).filter(dir => {
  const stat = fs.statSync(path.join(localesDir, dir));
  return stat.isDirectory();
});

console.log(`Found ${languages.length} languages to update`);

// Function to add keys to a messages.json file
function addKeysToLanguage(lang) {
  const messagesPath = path.join(localesDir, lang, 'messages.json');
  
  if (!fs.existsSync(messagesPath)) {
    console.log(`Skipping ${lang} - messages.json not found`);
    return;
  }

  try {
    const content = fs.readFileSync(messagesPath, 'utf8');
    const messages = JSON.parse(content);
    
    let updated = false;
    
    // Add new keys if they don't exist
    Object.keys(newKeys).forEach(key => {
      if (!messages[key]) {
        // Use Vietnamese translation for 'vi', English for 'en', or English as fallback
        const translation = lang === 'vi' ? viTranslations[key] : 
                           lang === 'en' ? newKeys[key] : 
                           newKeys[key]; // Will need manual translation
        
        messages[key] = {
          message: translation,
          description: getDescription(key)
        };
        
        // Add placeholders if needed
        if (key.includes('Count')) {
          messages[key].placeholders = {
            count: {
              content: "$1",
              example: key === 'checkedTextsWithCount' ? "150" : "5"
            }
          };
        }
        
        updated = true;
      }
    });
    
    if (updated) {
      // Write back with proper formatting
      fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2), 'utf8');
      console.log(`✓ Updated ${lang}`);
    } else {
      console.log(`- ${lang} already has all keys`);
    }
  } catch (error) {
    console.error(`Error processing ${lang}:`, error.message);
  }
}

function getDescription(key) {
  const descriptions = {
    "checkedLabel": "Checked label in quality report",
    "spelling": "Spelling check label",
    "grammar": "Grammar check label",
    "formatting": "Formatting check label",
    "noIssuesInOriginalText": "No issues message",
    "checkedTextsWithCount": "Checked texts count",
    "foundErrorsCount": "Found errors count",
    "noErrors": "No errors message",
    "qualityCheckReport": "Quality check report title"
  };
  return descriptions[key] || "";
}

// Process all languages
languages.forEach(lang => {
  addKeysToLanguage(lang);
});

console.log('\nDone! Note: Languages other than English and Vietnamese will need manual translation.');
