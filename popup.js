// Popup script
function i18n(key, ...substitutions) {
  if (substitutions.length > 0) {
    return chrome.i18n.getMessage(key, substitutions);
  }
  return chrome.i18n.getMessage(key) || key;
}

// Check if current tab is supported
async function isPageSupported(url) {
  if (!url) return false;
  return !url.startsWith('chrome://') && 
         !url.startsWith('about:') && 
         !url.startsWith('chrome-extension://');
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (await isPageSupported(tab?.url)) {
    // Supported page - open sidebar
    const settings = await chrome.storage.sync.get(['sourceLanguage', 'targetLanguage']);
    
    // Use smart defaults if not set (will be auto-detected in content script)
    const sourceLanguage = settings.sourceLanguage || null;
    const targetLanguage = settings.targetLanguage || null;
    
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'openSidebar',
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage
      });
      window.close();
    } catch (error) {
      // Content script not injected yet, try to inject
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            'i18n-helper.js',
            'languages-config.js',
            'bug-report-db.js',
            'bug-report-export.js',
            'drive-sync.js',
            'bug-report-manager.js',
            'bug-report-sidebar.js',
            'json-translator.js',
            'confirm-dialog.js',
            'text-shimmer.js',
            'content.js'
          ]
        });
        
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css', 'content-language-modern.css']
        });
        
        // Retry opening sidebar
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'openSidebar',
              sourceLanguage: sourceLanguage,
              targetLanguage: targetLanguage
            });
            window.close();
          } catch (retryError) {
            console.error('Failed to open sidebar:', retryError);
          }
        }, 100);
      } catch (injectError) {
        console.error('Failed to inject content script:', injectError);
        localizeUI();
      }
    }
  } else {
    // Unsupported page - show message
    localizeUI();
  }
});

function localizeUI() {
  document.getElementById('title').textContent = i18n('unsupportedPage');
  document.getElementById('subtitle').textContent = i18n('unsupportedPageSubtitle');
  document.getElementById('message').textContent = i18n('unsupportedPageMessage');
  document.getElementById('unsupported-title').textContent = i18n('unsupportedPagesTitle');
  document.getElementById('footer').textContent = i18n('unsupportedPageFooter');
}
