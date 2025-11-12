const fs = require('fs');
const archiver = require('archiver');
const path = require('path');

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Create a file to stream archive data to
const output = fs.createWriteStream(path.join(outputDir, 'localizeai-extension.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

// Listen for all archive data to be written
output.on('close', function() {
  console.log('✅ Extension packaged successfully!');
  console.log(`📦 Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📁 Location: dist/localizeai-extension.zip`);
});

// Handle errors
archive.on('error', function(err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Add files to archive
const filesToInclude = [
  'manifest.json',
  'popup.html',
  'popup.js',
  'popup.css',
  'content.js',
  'content.css',
  'background.js',
  'options.html',
  'options.js',
  'options.css',
  'icons/**'
];

filesToInclude.forEach(file => {
  if (file.includes('**')) {
    // Directory
    const dir = file.replace('/**', '');
    if (fs.existsSync(dir)) {
      archive.directory(dir, dir);
    }
  } else {
    // Single file
    if (fs.existsSync(file)) {
      archive.file(file, { name: file });
    }
  }
});

// Finalize the archive
archive.finalize();
