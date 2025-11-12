const fs = require('fs');
const path = require('path');

console.log('🔨 Building LocalizeAI Extension...\n');

// Check required files
const requiredFiles = [
  'manifest.json',
  'popup.html',
  'popup.js',
  'popup.css',
  'content.js',
  'content.css',
  'background.js',
  'options.html',
  'options.js',
  'options.css'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING!`);
    allFilesExist = false;
  }
});

// Check icons
console.log('\n📁 Checking icons...');
const iconSizes = ['16', '48', '128'];
iconSizes.forEach(size => {
  const iconPath = `icons/icon${size}.png`;
  if (fs.existsSync(iconPath)) {
    console.log(`✅ icon${size}.png`);
  } else {
    console.log(`⚠️  icon${size}.png - Missing (create placeholder)`);
    // Create placeholder
    if (!fs.existsSync('icons')) {
      fs.mkdirSync('icons');
    }
  }
});

// Validate manifest.json
console.log('\n🔍 Validating manifest.json...');
try {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  console.log(`✅ Name: ${manifest.name}`);
  console.log(`✅ Version: ${manifest.version}`);
  console.log(`✅ Manifest Version: ${manifest.manifest_version}`);
} catch (error) {
  console.log('❌ Invalid manifest.json:', error.message);
  allFilesExist = false;
}

// Check backend URL
console.log('\n🌐 Checking backend URLs...');
const filesToCheck = ['background.js', 'content.js', 'popup.js'];
let hasPlaceholderUrl = false;

filesToCheck.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('your-backend-url.run.app')) {
    console.log(`⚠️  ${file} - Contains placeholder URL`);
    hasPlaceholderUrl = true;
  } else {
    console.log(`✅ ${file} - Backend URL configured`);
  }
});

// Summary
console.log('\n' + '='.repeat(50));
if (allFilesExist && !hasPlaceholderUrl) {
  console.log('✅ Build check passed! Ready to package.');
  console.log('\nNext steps:');
  console.log('1. Run: npm run zip');
  console.log('2. Upload to Chrome Web Store');
} else {
  console.log('⚠️  Build check found issues:');
  if (!allFilesExist) {
    console.log('- Some required files are missing');
  }
  if (hasPlaceholderUrl) {
    console.log('- Update backend URLs before deploying');
  }
}
console.log('='.repeat(50));
