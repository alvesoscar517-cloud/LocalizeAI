// Content script - runs on every page
// Check if this is a fresh page load or duplicate injection
const isNewPageLoad = !window.localizeAIInjected;

if (window.localizeAIInjected) {
  // Stop execution to prevent duplicate listeners and state
  throw new Error('Content script already loaded');
}

// Mark as injected
window.localizeAIInjected = true;

let isActive = false;
let originalTexts = new Map();
let panelInjected = false;

// Detect if running in side panel
const isInSidePanel = window.location.href.includes('panel.html');

// Track if current action is from panel (to redirect notifications)
let currentActionFromPanel = false;

// Track active shimmer effects for panel buttons
let activeShimmers = {
  'ai-suggest-btn': null,
  'quality-check-btn': null,
  'smart-translate-btn': null
};

// Helper function to stop shimmer in panel
async function stopPanelShimmer(buttonId) {
  try {
    await chrome.runtime.sendMessage({
      action: 'stopShimmer',
      buttonId: buttonId
    });
  } catch (e) {
    // Silently fail if panel is not available
  }
}

// Listen for messages from popup or side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Skip if running in side panel (panel should not handle these, only send them)
  if (isInSidePanel) {
    return;
  }
  
  // Mark if action is from panel
  currentActionFromPanel = request.fromPanel || false;
  
  switch (request.action) {
    case 'ping':
      // Just respond to check if content script is loaded
      sendResponse({ success: true });
      break;
      

      
    case 'openSidebar':
      // Only set if provided, otherwise will be auto-detected in injectPanel
      if (request.sourceLanguage) currentSourceLang = request.sourceLanguage;
      if (request.targetLanguage) currentTargetLang = request.targetLanguage;
      
      if (!panelInjected) {
        injectPanel();
      }
      
      const panel = document.getElementById('localizeai-panel');
      panel.style.display = 'block';
      
      // Push body and html content
      document.body.classList.add('localizeai-sidebar-open');
      document.documentElement.classList.add('localizeai-sidebar-open');
      
      // Pre-scan page content for better performance
      preScanPageContent().catch(err => {
        console.error('[LocalizeAI] Pre-scan failed:', err);
      });
      
      sendResponse({ success: true });
      break;
      
    case 'showOriginal':
      showOriginal();
      sendResponse({ success: true });
      break;
      
    case 'showTranslated':
      if (request.sourceLanguage) currentSourceLang = request.sourceLanguage;
      if (request.targetLanguage) currentTargetLang = request.targetLanguage;
      showTranslated();
      sendResponse({ success: true });
      break;
      
    case 'clearCache':
      clearTranslationCache();
      sendResponse({ success: true });
      break;
      
    case 'sideBySide':
      toggleSideBySide(request.sourceLanguage, request.targetLanguage);
      sendResponse({ success: true });
      break;
      
    case 'pseudoLocalization':
      applyPseudoLocalization();
      sendResponse({ success: true });
      break;
      
    case 'liveEdit':
      enableLiveEdit();
      sendResponse({ success: true });
      break;
      
    case 'aiSuggestions':
      // When called from panel, skip shimmer (it's already running in panel)
      showAISuggestions(true).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        console.error('AI suggestions error:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response
      break;
      
    case 'qualityCheck':
      // When called from panel, skip shimmer (it's already running in panel)
      runQualityCheck(true);
      sendResponse({ success: true });
      break;
      
    case 'smartBatchTranslate':
      // When called from panel, skip shimmer (it's already running in panel)
      smartBatchTranslate(true);
      sendResponse({ success: true });
      break;
      
    case 'reportBug':
      toggleBugReport();
      sendResponse({ success: true });
      break;
      
    case 'viewReports':
      // Bug report sidebar should show in the same context (panel or page)
      showBugReportSidebar();
      sendResponse({ success: true });
      break;
      
    case 'jsonTranslator':
      if (window.jsonTranslator) {
        window.jsonTranslator.showDialog();
      }
      sendResponse({ success: true });
      break;
      
    case 'getState':
      // Return current state to panel
      sendResponse({
        bugReportMode: bugReportMode,
        liveEditEnabled: liveEditEnabled,
        isPseudoLocActive: isPseudoLocActive,
        isTranslated: isTranslated,
        isTranslating: isTranslating,
        translationCount: translations.size,
        statusMessage: currentStatusMessage || '',
        statusType: currentStatusType || 'info'
      });
      break;
      
    case 'getBugReports':
      // Get all bug reports from page's IndexedDB
      bugReportDB.getAllReports().then(reports => {
        sendResponse({ reports: reports });
      }).catch(error => {
        console.error('Failed to get bug reports:', error);
        sendResponse({ reports: [], error: error.message });
      });
      return true; // Async response
      
    case 'deleteBugReport':
      // Delete a bug report
      bugReportDB.deleteReport(request.id).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response
      
    case 'updateBugReport':
      // Update a bug report
      bugReportDB.updateReport(request.id, request.updates).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response
      
    case 'clearAllBugReports':
      // Clear all bug reports
      bugReportDB.clearAll().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response
      
    case 'showBugDetails':
      // Show bug details dialog on page (called from panel)
      showBugDetailsOnPage(request.report);
      sendResponse({ success: true });
      break;
      
    case 'showUpgradeDialog':
      // Show upgrade dialog on page (called from panel)
      showUpgradeDialog();
      sendResponse({ success: true });
      break;
      
    case 'showPremiumInfoDialog':
      // Show premium info dialog on page (called from panel)
      showPremiumInfoDialog();
      sendResponse({ success: true });
      break;
  }
  
  // Reset flag after handling - longer timeout for AI operations
  setTimeout(() => {
    currentActionFromPanel = false;
  }, 30000); // 30 seconds to allow AI operations to complete
  
  return true; // Keep message channel open for async response
});

// If running in side panel, initialize the UI
if (isInSidePanel) {
  let currentTabId = null;
  let statePollingInterval = null;
  let loadingStartTime = 0;
  
  // Function to refresh panel for current tab
  async function refreshPanelForCurrentTab() {
    // Show loading screen FIRST
    showPanelLoading();
    
    // Record when loading started
    const startTime = Date.now();
    loadingStartTime = startTime;
    
    // Start minimum loading time promise immediately (500ms)
    const minLoadingPromise = new Promise(resolve => {
      setTimeout(resolve, 500);
    });
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      await minLoadingPromise;
      showUnsupportedPageInPanel();
      return;
    }
    
    // Update current tab ID
    const previousTabId = currentTabId;
    currentTabId = tab.id;
    
    if (!isPageSupported(tab.url)) {
      // Show unsupported page message
      await minLoadingPromise;
      showUnsupportedPageInPanel();
      return;
    }
    
    // Do preparation work (but DON'T render panel yet)
    const workPromise = (async () => {
      // Inject content script into the page first
      await injectContentScriptIntoPage(tab.id);
      
      await initializeLanguageSettings();
      // DON'T call injectPanel() here - it will replace loading screen!
    })();
    
    // Wait for BOTH work to complete AND minimum time to pass
    await Promise.all([workPromise, minLoadingPromise]);
    
    // NOW render the panel (after 500ms has passed)
    await injectPanel();
    
    // Add current page indicator
    addCurrentPageIndicator(tab);
    
    // ALWAYS re-setup panel mode for new tab (this is critical!)
    // This ensures all event listeners target the correct tab
    await setupPanelMode(tab.id);
    
    // Get and sync state from the active tab's content script
    await syncStateFromActiveTab(tab.id);
  }
  

  
  // Sync panel state with active tab's content script state
  async function syncStateFromActiveTab(tabId) {
    try {
      // Retry logic for content script that might be initializing
      let retries = 3;
      let response = null;
      
      while (retries > 0 && !response) {
        try {
          response = await chrome.tabs.sendMessage(tabId, { action: 'getState' });
          if (response) break;
        } catch (e) {
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }
      
      if (response) {
        updatePanelUIFromState(response);
      } else {
        // Reset UI to default state
        resetPanelUIToDefault();
      }
    } catch (error) {
      resetPanelUIToDefault();
    }
  }
  
  // Reset panel UI to default state (for new pages)
  function resetPanelUIToDefault() {
    // Reset toggle buttons
    const showOriginalBtn = document.getElementById('show-original');
    const showTranslatedBtn = document.getElementById('show-translated');
    
    if (showOriginalBtn && showTranslatedBtn) {
      showOriginalBtn.classList.add('active');
      showTranslatedBtn.classList.remove('active');
    }
    
    // Reset status message
    const statusElement = document.getElementById('translation-status');
    if (statusElement) {
      statusElement.innerHTML = `
        <img src="${chrome.runtime.getURL('icons/lucide/info.svg')}" class="status-icon" width="16" height="16">
        <span>${i18n('readyToTranslate')}</span>
      `;
    }
    
    // Hide clear cache button
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    if (clearCacheBtn) {
      clearCacheBtn.style.display = 'none';
    }
    
    // Reset all feature buttons
    const bugReportBtn = document.getElementById('bug-report-btn');
    if (bugReportBtn) {
      bugReportBtn.classList.remove('active');
      const btnText = bugReportBtn.querySelector('span');
      if (btnText) btnText.textContent = i18n('reportBug');
    }
    
    const liveEditBtn = document.getElementById('live-edit-btn');
    if (liveEditBtn) {
      liveEditBtn.classList.remove('active');
      const btnText = liveEditBtn.querySelector('span');
      if (btnText) btnText.textContent = i18n('enableLiveEdit');
    }
    
    const pseudoLocBtn = document.getElementById('pseudo-loc-btn');
    if (pseudoLocBtn) {
      pseudoLocBtn.classList.remove('active');
      const btnText = pseudoLocBtn.querySelector('span');
      if (btnText) btnText.textContent = i18n('applyPseudoLoc');
    }
  }
  
  // Update panel UI based on content script state
  function updatePanelUIFromState(state) {
    // Update toggle buttons
    const showOriginalBtn = document.getElementById('show-original');
    const showTranslatedBtn = document.getElementById('show-translated');
    
    if (showOriginalBtn && showTranslatedBtn) {
      if (state.isTranslated) {
        showOriginalBtn.classList.remove('active');
        showTranslatedBtn.classList.add('active');
      } else {
        showOriginalBtn.classList.add('active');
        showTranslatedBtn.classList.remove('active');
      }
    }
    
    // Update status message
    const statusElement = document.getElementById('translation-status');
    if (statusElement && state.statusMessage) {
      const iconMap = {
        'success': 'check-circle',
        'error': 'alert-circle',
        'warning': 'alert-triangle',
        'info': 'info'
      };
      const iconName = iconMap[state.statusType] || 'info';
      
      statusElement.innerHTML = `
        <img src="${chrome.runtime.getURL(`icons/lucide/${iconName}.svg`)}" class="status-icon" width="16" height="16">
        <span>${state.statusMessage}</span>
      `;
    }
    
    // Show/hide clear cache button
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    if (clearCacheBtn) {
      clearCacheBtn.style.display = state.translationCount > 0 ? 'flex' : 'none';
    }
    
    // Update bug report button state
    const bugReportBtn = document.getElementById('bug-report-btn');
    if (bugReportBtn) {
      if (state.bugReportMode) {
        bugReportBtn.classList.add('active');
        bugReportBtn.querySelector('span').textContent = i18n('exitBugReport');
      } else {
        bugReportBtn.classList.remove('active');
        bugReportBtn.querySelector('span').textContent = i18n('reportBug');
      }
    }
    
    // Update live edit button state
    const liveEditBtn = document.getElementById('live-edit-btn');
    if (liveEditBtn) {
      if (state.liveEditEnabled) {
        liveEditBtn.classList.add('active');
        liveEditBtn.querySelector('span').textContent = i18n('disableLiveEdit');
      } else {
        liveEditBtn.classList.remove('active');
        liveEditBtn.querySelector('span').textContent = i18n('enableLiveEdit');
      }
    }
    
    // Update pseudo-loc button state
    const pseudoLocBtn = document.getElementById('pseudo-loc-btn');
    if (pseudoLocBtn && state.isPseudoLocActive) {
      pseudoLocBtn.classList.add('active');
      pseudoLocBtn.querySelector('span').textContent = i18n('removePseudoLoc');
    } else if (pseudoLocBtn) {
      pseudoLocBtn.classList.remove('active');
      pseudoLocBtn.querySelector('span').textContent = i18n('applyPseudoLoc');
    }
  }
  
  document.addEventListener('DOMContentLoaded', async () => {
    // refreshPanelForCurrentTab will handle showing loading
    await refreshPanelForCurrentTab();
  });
  
  // Show loading indicator
  function showPanelLoading() {
    const panel = document.getElementById('localizeai-panel');
    if (panel) {
      panel.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; gap: 24px; padding: 40px 20px;">
          <!-- App Logo and Name -->
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <img src="${chrome.runtime.getURL('icons/icon128.png')}" width="48" height="48" alt="LocalizeAI" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <h3 style="margin: 0; font-size: 20px; font-weight: 600; color: #111827; letter-spacing: -0.5px;">
                LocalizeAI
              </h3>
              <p style="margin: 0; font-size: 11px; color: #9ca3af; font-weight: 500;">AI Translation Testing</p>
            </div>
          </div>
          
          <!-- Loading Spinner -->
          <div style="width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          
          <!-- Loading Text -->
          <div style="font-size: 13px; color: #6b7280; font-weight: 500;">${i18n('loading') || 'Loading...'}</div>
        </div>
        <style>
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      `;
    }
  }
  
  // Listen for tab changes
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    // Don't call showPanelLoading() here - let refreshPanelForCurrentTab handle it
    await refreshPanelForCurrentTab();
  });
  
  // Listen for tab updates (URL changes)
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tabId === currentTabId) {
      // Don't call showPanelLoading() here - let refreshPanelForCurrentTab handle it
      await refreshPanelForCurrentTab();
    }
  });
  
  // Listen for notification messages from page
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showNotificationInPanel') {
      // Show notification in panel
      showNotification(request.message, request.iconName, request.duration);
      sendResponse({ success: true });
    } else if (request.action === 'stopShimmer') {
      // Stop shimmer effect in panel
      const shimmer = activeShimmers[request.buttonId];
      if (shimmer) {
        shimmer.stop();
        activeShimmers[request.buttonId] = null;
      }
      sendResponse({ success: true });
    }
    return true;
  });
}

// Inject content script into active page
async function injectContentScriptIntoPage(tabId) {
  try {
    // Try to send a ping message first to check if already injected
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response && response.success) {
        return;
      }
    } catch (e) {
      // Not injected or not responding, proceed with injection
    }
    
    // Inject scripts
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [
        'xlsx.full.min.js',
        'i18n-helper.js',
        'languages-config.js',
        'translate-client.js',
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
    
    // Inject CSS
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['content.css', 'content-language-modern.css', 'content-modal-modern.css']
    });
    
    // Wait a bit for script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
  } catch (error) {
    console.error('[Panel] Failed to inject content script:', error);
    throw error;
  }
}

// Helper to check if page is supported
function isPageSupported(url) {
  if (!url) return false;
  return !url.startsWith('chrome://') && 
         !url.startsWith('about:') && 
         !url.startsWith('chrome-extension://') &&
         !url.startsWith('edge://') &&
         !url.startsWith('chrome.google.com/webstore');
}

// Show unsupported page message in panel
function showUnsupportedPageInPanel() {
  const panel = document.getElementById('localizeai-panel');
  if (!panel) return;
  
  // Random animation selection
  const animations = [
    { file: 'Error 404.json', name: 'Error 404' },
    { file: 'Cat playing animation.json', name: 'Cat Playing' }
  ];
  const randomAnimation = animations[Math.floor(Math.random() * animations.length)];
  
  panel.innerHTML = `
    <div style="padding: 40px 20px; text-align: center;">
      <div id="lottie-unsupported-animation" style="width: 280px; height: 280px; margin: 0 auto 20px;"></div>
      
      <h2 style="font-size: 18px; color: #111827; font-weight: 600; margin-bottom: 8px;">${i18n('unsupportedPage')}</h2>
      <p style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">${i18n('unsupportedPageSubtitle')}</p>
      
      <p style="font-size: 13px; color: #4b5563; line-height: 1.6; margin: 20px 0;">${i18n('unsupportedPageMessage')}</p>
      
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: left;">
        <div style="font-size: 12px; font-weight: 600; color: #991b1b; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <img src="${chrome.runtime.getURL('icons/lucide/x-circle.svg')}" width="16" height="16">
          <span>${i18n('unsupportedPagesTitle')}</span>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0;">
          <li style="font-size: 12px; color: #7f1d1d; padding: 6px 0; display: flex; align-items: center; gap: 8px;">
            <img src="${chrome.runtime.getURL('icons/lucide/x.svg')}" width="14" height="14">
            <span>chrome:// (Chrome internal pages)</span>
          </li>
          <li style="font-size: 12px; color: #7f1d1d; padding: 6px 0; display: flex; align-items: center; gap: 8px;">
            <img src="${chrome.runtime.getURL('icons/lucide/x.svg')}" width="14" height="14">
            <span>about:// (Browser settings)</span>
          </li>
          <li style="font-size: 12px; color: #7f1d1d; padding: 6px 0; display: flex; align-items: center; gap: 8px;">
            <img src="${chrome.runtime.getURL('icons/lucide/x.svg')}" width="14" height="14">
            <span>chrome-extension:// (Extension pages)</span>
          </li>
        </ul>
      </div>
      
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; display: flex; align-items: start; gap: 12px; text-align: left;">
        <img src="${chrome.runtime.getURL('icons/lucide/lightbulb.svg')}" width="20" height="20" style="flex-shrink: 0; margin-top: 2px;">
        <div style="font-size: 12px; color: #166534; line-height: 1.6;">${i18n('unsupportedPageFooter')}</div>
      </div>
    </div>
  `;
  
  // Load and play random Lottie animation
  if (typeof lottie !== 'undefined') {
    fetch(chrome.runtime.getURL(`animation/${randomAnimation.file}`))
      .then(response => response.json())
      .then(animationData => {
        const container = document.getElementById('lottie-unsupported-animation');
        if (container) {
          lottie.loadAnimation({
            container: container,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: animationData
          });
        }
      })
      .catch(error => {
        console.error('[LocalizeAI] Failed to load Lottie animation:', error);
      });
  }
}

// Language Toggle State
let isTranslated = false;
let currentSourceLang = null; // Will be auto-detected
let currentTargetLang = null; // Will be auto-detected
let translations = new Map(); // Store translations for quality check
let translationMemory = new Map(); // Cache translations for reuse
let glossary = new Map(); // User-defined term translations
let isTranslating = false;
let currentStatusMessage = '';
let currentStatusType = 'info';

// Pre-scanned text cache for better performance
let textNodesCache = null;
let textElementsCache = null;
let lastScanTime = 0;
let isScanning = false;

// MutationObserver to detect dynamic content changes (SPA, AJAX, etc.)
let domObserver = null;
let observerDebounceTimer = null;

// Initialize MutationObserver for dynamic content
function initDOMObserver() {
  // Skip if already initialized or in side panel
  if (domObserver || isInSidePanel) return;
  
  domObserver = new MutationObserver((mutations) => {
    // Check if there are significant changes (added/removed nodes with text)
    let hasSignificantChanges = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Check if added nodes contain text
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text && text.length > 1) {
              hasSignificantChanges = true;
              break;
            }
          }
        }
        
        // Check if removed nodes contained text
        if (!hasSignificantChanges) {
          for (const node of mutation.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
              const text = node.textContent?.trim();
              if (text && text.length > 1) {
                hasSignificantChanges = true;
                break;
              }
            }
          }
        }
      }
      
      if (hasSignificantChanges) break;
    }
    
    if (hasSignificantChanges) {
      // Debounce: wait 500ms after last change before invalidating
      clearTimeout(observerDebounceTimer);
      observerDebounceTimer = setTimeout(() => {
        // Invalidate cache so next translation will re-scan
        textNodesCache = null;
        textElementsCache = null;
        lastScanTime = 0;
        
        // If currently translated, re-translate automatically
        if (isTranslated && !isTranslating) {
          // Clear translations for removed nodes
          const currentNodes = getTextNodesImproved(document.body);
          const currentNodeSet = new Set(currentNodes);
          
          // Remove translations for nodes that no longer exist
          for (const [node] of translations) {
            if (!currentNodeSet.has(node) && !document.body.contains(node)) {
              translations.delete(node);
              originalTexts.delete(node);
            }
          }
          
          // Re-translate to pick up new content
          showTranslated();
        }
      }, 500);
    }
  });
  
  // Observe entire document for changes
  domObserver.observe(document.body, {
    childList: true,      // Watch for added/removed nodes
    subtree: true,        // Watch entire tree
    characterData: false  // Don't watch text changes (too noisy)
  });
}

// Stop DOM observer (cleanup)
function stopDOMObserver() {
  if (domObserver) {
    domObserver.disconnect();
    domObserver = null;
  }
  
  if (observerDebounceTimer) {
    clearTimeout(observerDebounceTimer);
    observerDebounceTimer = null;
  }
}

// Reset state when page unloads (navigation)
window.addEventListener('beforeunload', () => {
  stopDOMObserver();
  // Mark as not injected so new page can initialize fresh
  window.localizeAIInjected = false;
});

// Also listen for page hide (for back/forward cache)
window.addEventListener('pagehide', () => {
  stopDOMObserver();
  window.localizeAIInjected = false;
});

// Initialize DOM observer when page is ready
if (!isInSidePanel) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDOMObserver);
  } else {
    // DOM already loaded
    initDOMObserver();
  }
}

// Initialize language settings with smart defaults
async function initializeLanguageSettings() {
  // Try to load saved preferences first
  const saved = await chrome.storage.sync.get(['sourceLanguage', 'targetLanguage']);
  
  if (saved.sourceLanguage && saved.targetLanguage) {
    currentSourceLang = saved.sourceLanguage;
    currentTargetLang = saved.targetLanguage;
  } else {
    // Auto-detect page language for source
    const pageLang = LanguageHelper.detectPageLanguage();
    const browserLang = LanguageHelper.detectBrowserLanguage();
    
    // Set source to detected page language
    currentSourceLang = pageLang;
    
    // Smart target language selection
    // If page is in browser language, suggest English
    // Otherwise suggest browser language
    if (pageLang === browserLang) {
      currentTargetLang = 'en';
    } else {
      currentTargetLang = browserLang;
    }
    
    // Save defaults
    await chrome.storage.sync.set({
      sourceLanguage: currentSourceLang,
      targetLanguage: currentTargetLang
    });
  }
}

// Add current page indicator to panel
function addCurrentPageIndicator(tab) {
  if (!isInSidePanel) return;
  
  const panel = document.getElementById('localizeai-panel');
  if (!panel) return;
  
  // Remove existing indicator if any
  const existingIndicator = document.getElementById('current-page-indicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }
  
  // Get domain from URL
  let displayUrl = tab.url;
  try {
    const url = new URL(tab.url);
    displayUrl = url.hostname || tab.url;
  } catch (e) {
    // Keep original URL if parsing fails
  }
  
  // Create indicator
  const indicator = document.createElement('div');
  indicator.id = 'current-page-indicator';
  indicator.style.cssText = `
    padding: 6px 16px;
    background: #eff6ff;
    border-bottom: 1px solid #dbeafe;
    font-size: 11px;
    color: #3b82f6;
    display: flex;
    align-items: center;
    gap: 8px;
    position: sticky;
    top: 0;
    z-index: 100;
  `;
  
  indicator.innerHTML = `
    <img src="${chrome.runtime.getURL('icons/lucide/globe.svg')}" width="14" height="14" style="flex-shrink: 0; opacity: 0.7;">
    <div style="flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;" title="${tab.url}">${displayUrl}</div>
  `;
  
  // Insert at the beginning of panel
  const sidebar = panel.querySelector('.localizeai-sidebar');
  if (sidebar) {
    sidebar.insertBefore(indicator, sidebar.firstChild);
  }
}

async function injectPanel() {
  // Create floating expand button (separate from panel) - only if not in side panel
  if (!isInSidePanel) {
    const fab = document.createElement('button');
    fab.id = 'localizeai-expand-fab';
    fab.className = 'localizeai-expand-fab';
    fab.title = i18n('clickToExpand');
    fab.style.display = 'none';
    fab.innerHTML = `<img src="${chrome.runtime.getURL('icons/lucide/arrow-left.svg')}" width="20" height="20">`;
    document.body.appendChild(fab);
  }
  
  // Get or create panel element
  let panel = document.getElementById('localizeai-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'localizeai-panel';
  }
  
  panel.innerHTML = `
    <div class="localizeai-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <img src="${chrome.runtime.getURL('icons/icon128.png')}" class="sidebar-logo-icon" width="24" height="24" alt="LocalizeAI">
          <h3>Localize<span class="ai-gradient">AI</span></h3>
        </div>
        <div class="collapsed-indicator" title="${i18n('clickToExpand')}">
          <img src="${chrome.runtime.getURL('icons/lucide/arrow-left.svg')}" class="expand-hint-icon" width="20" height="20">
        </div>
        <div class="header-actions">
          <button id="localizeai-collapse" title="${i18n('collapse')}">
            <img src="${chrome.runtime.getURL('icons/lucide/arrow-right.svg')}" class="collapse-icon" width="20" height="20">
          </button>
          <button id="localizeai-close" title="${i18n('close')}">
            <img src="${chrome.runtime.getURL('icons/lucide/x.svg')}" class="close-icon" width="20" height="20">
          </button>
        </div>
      </div>
      
      <div class="sidebar-content">
        <!-- Language Settings -->
        <div class="language-settings">
          <div class="lang-select-modern">
            <label class="lang-label">
              <img src="${chrome.runtime.getURL('icons/lucide/file-text.svg')}" width="14" height="14">
              <span>${i18n('source')}</span>
            </label>
            <div class="lang-dropdown-wrapper">
              <button type="button" class="lang-selected-btn" id="source-lang-btn">
                <span class="lang-native" id="source-lang-native">English</span>
                <img src="${chrome.runtime.getURL('icons/lucide/chevron-down.svg')}" class="lang-chevron" width="16" height="16">
              </button>
              <div class="lang-dropdown-menu" id="source-lang-dropdown" style="display: none;">
                <div class="lang-search-box">
                  <img src="${chrome.runtime.getURL('icons/lucide/search.svg')}" width="16" height="16">
                  <input type="text" id="source-lang-search" placeholder="" autocomplete="off">
                </div>
                <div class="lang-list" id="source-lang-list">
                  <!-- Will be populated dynamically -->
                </div>
              </div>
            </div>
          </div>
          
          <div class="lang-select-modern">
            <label class="lang-label">
              <img src="${chrome.runtime.getURL('icons/lucide/globe.svg')}" width="14" height="14">
              <span>${i18n('target')}</span>
            </label>
            <div class="lang-dropdown-wrapper">
              <button type="button" class="lang-selected-btn" id="target-lang-btn">
                <span class="lang-native" id="target-lang-native">Vietnamese</span>
                <img src="${chrome.runtime.getURL('icons/lucide/chevron-down.svg')}" class="lang-chevron" width="16" height="16">
              </button>
              <div class="lang-dropdown-menu" id="target-lang-dropdown" style="display: none;">
                <div class="lang-search-box">
                  <img src="${chrome.runtime.getURL('icons/lucide/search.svg')}" width="16" height="16">
                  <input type="text" id="target-lang-search" placeholder="" autocomplete="off">
                </div>
                <div class="lang-list" id="target-lang-list">
                  <!-- Will be populated dynamically -->
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Auto-detected info -->
        <div id="lang-auto-detect-info" style="display: none; padding: 10px 14px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-left: 3px solid #3b82f6; border-radius: 10px; margin: 12px 16px; font-size: 12px; color: #1e40af; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);">
          <img src="${chrome.runtime.getURL('icons/lucide/check-circle.svg')}" width="14" height="14" style="vertical-align: middle; margin-right: 6px;">
          <span id="lang-auto-detect-text">${i18n('autoDetected')}</span>
        </div>

        <!-- Language Toggle -->
        <div class="feature-section">
          <div class="section-header">
            <img src="${chrome.runtime.getURL('icons/lucide/languages.svg')}" class="section-icon" width="20" height="20">
            <h4>${i18n('languageToggle')}</h4>
            <div class="feature-info-trigger" style="position: relative; margin-left: 8px;">
              <img src="${chrome.runtime.getURL('icons/lucide/info.svg')}" width="16" height="16" style="cursor: help; opacity: 0.5; transition: opacity 0.2s;">
              <div class="feature-tooltip" style="display: none; position: fixed; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; max-width: 320px; min-width: 250px; font-size: 12px; line-height: 1.6; color: #856404; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10001; white-space: normal;">
                <strong style="display: block; margin-bottom: 6px; color: #856404;">${i18n('howItWorks')}</strong>
                ${i18n('languageToggleInfo').replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
          <p class="feature-desc">${i18n('languageToggleDesc')}</p>
          <div class="toggle-buttons">
            <button id="show-original" class="toggle-btn active">
              <img src="${chrome.runtime.getURL('icons/lucide/file-text.svg')}" class="btn-icon-sm" width="16" height="16">
              <span>${i18n('original')}</span>
            </button>
            <button id="show-translated" class="toggle-btn">
              <img src="${chrome.runtime.getURL('icons/lucide/globe.svg')}" class="btn-icon-sm" width="16" height="16">
              <span>${i18n('translated')}</span>
            </button>
          </div>
          <div id="translation-status" class="status-text">
            <img src="${chrome.runtime.getURL('icons/lucide/info.svg')}" class="status-icon" width="16" height="16">
            <span>${i18n('readyToTranslate')}</span>
          </div>
          <button id="clear-cache-btn" class="clear-cache-btn" style="display: none;">
            <img src="${chrome.runtime.getURL('icons/lucide/trash-2.svg')}" width="16" height="16">
            <span>${i18n('clearCacheRetranslate')}</span>
          </button>
        </div>

        <!-- Pseudo Localization -->
        <div class="feature-section">
          <div class="section-header">
            <img src="${chrome.runtime.getURL('icons/lucide/type.svg')}" class="section-icon" width="20" height="20">
            <h4>${i18n('pseudoLocalization')}</h4>
            <div class="pseudo-loc-info-trigger" style="position: relative; margin-left: 8px;">
              <img src="${chrome.runtime.getURL('icons/lucide/info.svg')}" width="16" height="16" style="cursor: help; opacity: 0.5; transition: opacity 0.2s;">
              <div class="pseudo-loc-tooltip" style="display: none; position: fixed; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; max-width: 320px; min-width: 250px; font-size: 12px; line-height: 1.6; color: #856404; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10001; white-space: normal;">
                <strong style="display: block; margin-bottom: 6px; color: #856404;">${i18n('howItWorks')}</strong>
                ${i18n('pseudoLocalizationInfo').replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
          <p class="feature-desc">${i18n('pseudoLocalizationDesc')}</p>
          <button id="pseudo-loc-btn" class="action-btn">
            <img src="${chrome.runtime.getURL('icons/lucide/sliders.svg')}" class="btn-icon-sm" width="16" height="16">
            <span>${i18n('applyPseudoLoc')}</span>
          </button>
        </div>

        <!-- Live Edit -->
        <div class="feature-section">
          <div class="section-header">
            <img src="${chrome.runtime.getURL('icons/lucide/edit.svg')}" class="section-icon" width="20" height="20">
            <h4>${i18n('liveEditMode')}</h4>
            <div class="feature-info-trigger" style="position: relative; margin-left: 8px;">
              <img src="${chrome.runtime.getURL('icons/lucide/info.svg')}" width="16" height="16" style="cursor: help; opacity: 0.5; transition: opacity 0.2s;">
              <div class="feature-tooltip" style="display: none; position: fixed; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; max-width: 320px; min-width: 250px; font-size: 12px; line-height: 1.6; color: #856404; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10001; white-space: normal;">
                <strong style="display: block; margin-bottom: 6px; color: #856404;">${i18n('howItWorks')}</strong>
                ${i18n('liveEditModeInfo').replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
          <p class="feature-desc">${i18n('liveEditModeDesc')}</p>
          <button id="live-edit-btn" class="action-btn">
            <img src="${chrome.runtime.getURL('icons/lucide/list.svg')}" class="btn-icon-sm" width="16" height="16">
            <span>${i18n('enableLiveEdit')}</span>
          </button>
        </div>

        <!-- AI Features -->
        <div class="feature-section">
          <div class="section-header">
            <img src="${chrome.runtime.getURL('icons/lucide/sparkles.svg')}" class="section-icon premium-icon" width="20" height="20" style="filter: brightness(0) saturate(100%) invert(77%) sepia(85%) saturate(1352%) hue-rotate(359deg) brightness(98%) contrast(101%);">
            <h4>${i18n('aiFeatures')}</h4>
            <div class="feature-info-trigger" style="position: relative; margin-left: 8px;">
              <img src="${chrome.runtime.getURL('icons/lucide/info.svg')}" width="16" height="16" style="cursor: help; opacity: 0.5; transition: opacity 0.2s;">
              <div class="feature-tooltip" style="display: none; position: fixed; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; max-width: 320px; min-width: 250px; font-size: 12px; line-height: 1.6; color: #856404; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10001; white-space: normal;">
                <strong style="display: block; margin-bottom: 6px; color: #856404;">${i18n('premiumFeatures')}</strong>
                ${i18n('aiFeaturesInfo').replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
          <p class="feature-desc">${i18n('aiFeaturesDesc')}</p>
          <button id="ai-suggest-btn" class="action-btn premium">
            <img src="${chrome.runtime.getURL('icons/lucide/brain.svg')}" class="btn-icon-sm" width="16" height="16">
            <span>${i18n('getAISuggestions')}</span>
            <span class="badge">${i18n('premium')}</span>
          </button>
          <button id="smart-translate-btn" class="action-btn premium" style="margin-top: 8px;">
            <img src="${chrome.runtime.getURL('icons/lucide/lightbulb.svg')}" class="btn-icon-sm" width="16" height="16">
            <span>${i18n('smartBatchTranslate')}</span>
            <span class="badge">${i18n('premium')}</span>
          </button>
          <div id="smart-translate-info" style="display: none; margin-top: 8px; padding: 10px; background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 10px; font-size: 12px; color: #1e40af;">
            <img src="${chrome.runtime.getURL('icons/lucide/info.svg')}" width="14" height="14" style="vertical-align: middle; margin-right: 6px;">
            <span id="smart-translate-info-text">${i18n('smartBatchTranslateInfo')}</span>
          </div>
          <button id="quality-check-btn" class="action-btn premium" style="margin-top: 8px;">
            <img src="${chrome.runtime.getURL('icons/lucide/check-circle.svg')}" class="btn-icon-sm" width="16" height="16">
            <span>${i18n('checkTranslationQuality')}</span>
            <span class="badge">${i18n('premium')}</span>
          </button>
        </div>

        <!-- JSON File Translator -->
        <div class="feature-section">
          <div class="section-header">
            <img src="${chrome.runtime.getURL('icons/lucide/file-json.svg')}" class="section-icon" width="20" height="20">
            <h4>${i18n('jsonFileTranslator')}</h4>
            <div class="feature-info-trigger" style="position: relative; margin-left: 8px;">
              <img src="${chrome.runtime.getURL('icons/lucide/info.svg')}" width="16" height="16" style="cursor: help; opacity: 0.5; transition: opacity 0.2s;">
              <div class="feature-tooltip" style="display: none; position: fixed; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; max-width: 320px; min-width: 250px; font-size: 12px; line-height: 1.6; color: #856404; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10001; white-space: normal;">
                <strong style="display: block; margin-bottom: 6px; color: #856404;">${i18n('howItWorks')}</strong>
                ${i18n('jsonFileTranslatorInfo').replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
          <p class="feature-desc">${i18n('jsonFileTranslatorDesc')}</p>
          <button id="json-translator-btn" class="action-btn">
            <img src="${chrome.runtime.getURL('icons/lucide/languages.svg')}" class="btn-icon-sm" width="16" height="16">
            <span>${i18n('translateJSONFile')}</span>
          </button>
        </div>

        <!-- Bug Report -->
        <div class="feature-section">
          <div class="section-header">
            <img src="${chrome.runtime.getURL('icons/lucide/bug.svg')}" class="section-icon" width="20" height="20">
            <h4>${i18n('reportIssue')}</h4>
            <div class="feature-info-trigger" style="position: relative; margin-left: 8px;">
              <img src="${chrome.runtime.getURL('icons/lucide/info.svg')}" width="16" height="16" style="cursor: help; opacity: 0.5; transition: opacity 0.2s;">
              <div class="feature-tooltip" style="display: none; position: fixed; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; max-width: 320px; min-width: 250px; font-size: 12px; line-height: 1.6; color: #856404; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10001; white-space: normal;">
                <strong style="display: block; margin-bottom: 6px; color: #856404;">${i18n('howItWorks')}</strong>
                ${i18n('reportIssueInfo').replace(/\n/g, '<br>')}
              </div>
            </div>
            <span id="bug-report-badge" style="display: none; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 8px;">0</span>
          </div>
          <p class="feature-desc">${i18n('reportIssueDesc')}</p>
          <button id="bug-report-btn" class="action-btn">
            <img src="${chrome.runtime.getURL('icons/lucide/flag.svg')}" class="btn-icon-sm" width="16" height="16">
            <span>${i18n('startReporting')}</span>
          </button>
          <button id="view-reports-btn" class="action-btn" style="margin-top: 8px;">
            <img src="${chrome.runtime.getURL('icons/lucide/file-text.svg')}" class="btn-icon-sm" width="16" height="16">
            <span>${i18n('manageReports')}</span>
          </button>
        </div>

        <!-- Account Section -->
        <div class="feature-section" id="premium-section-container">
          <div class="section-header">
            <img src="${chrome.runtime.getURL('icons/lucide/user.svg')}" class="section-icon" width="20" height="20">
            <h4>${i18n('account')}</h4>
          </div>
          
          <!-- Not Signed In -->
          <div id="premium-not-signed-in" style="display: none;">
            <button id="signin-btn" class="google-signin-btn-sidebar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              ${i18n('signInWithGoogle')}
            </button>
          </div>

          <!-- Signed In - Free Plan -->
          <div id="premium-free-view" style="display: none;">
            <div class="user-profile-card-sidebar">
              <div class="user-info-sidebar">
                <div class="user-avatar-fallback" id="free-user-avatar-fallback">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <img id="free-user-avatar" class="user-avatar-sidebar" style="display: none;">
                <div class="user-details-sidebar">
                  <p class="user-name-sidebar" id="free-user-name">User Name</p>
                  <p class="user-email-sidebar" id="free-user-email">user@example.com</p>
                </div>
              </div>
              <button id="upgrade-btn" class="upgrade-btn-sidebar">
                <img src="${chrome.runtime.getURL('icons/lucide/crown.svg')}" width="16" height="16" style="filter: brightness(0) invert(1);">
                ${i18n('upgradeToPremium')}
              </button>
              <div class="account-actions-sidebar">
                <button id="sync-drive-btn" class="action-btn-sidebar" title="${i18n('syncData')}">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                  ${i18n('sync')}
                </button>
                <button id="free-signout-btn" class="action-btn-sidebar" title="${i18n('signOut')}">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  ${i18n('signOut')}
                </button>
              </div>
            </div>
          </div>

          <!-- Signed In - Premium Active -->
          <div id="premium-active-view" style="display: none;">
            <div class="user-profile-card-sidebar">
              <div class="user-info-sidebar">
                <div class="user-avatar-fallback" id="premium-user-avatar-fallback">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <img id="premium-user-avatar" class="user-avatar-sidebar" style="display: none;">
                <div class="user-details-sidebar">
                  <p class="user-name-sidebar" id="premium-user-name">User Name</p>
                  <p class="user-email-sidebar" id="premium-email">user@example.com</p>
                </div>
              </div>
              <button id="premium-info-btn" class="premium-info-btn-sidebar">
                <img src="${chrome.runtime.getURL('icons/lucide/crown.svg')}" width="16" height="16">
                ${i18n('premiumInfo')}
              </button>
              <div class="account-actions-sidebar">
                <button id="premium-sync-drive-btn" class="action-btn-sidebar" title="${i18n('syncData')}">
                  <img src="${chrome.runtime.getURL('icons/lucide/refresh-cw.svg')}" width="16" height="16">
                  ${i18n('sync')}
                </button>
                <button id="premium-signout-btn" class="action-btn-sidebar" title="${i18n('signOut')}">
                  <img src="${chrome.runtime.getURL('icons/lucide/log-out.svg')}" width="16" height="16">
                  ${i18n('signOut')}
                </button>
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  `;
  
  // Only append to body if not in side panel (in panel, element already exists in HTML)
  if (!isInSidePanel && !document.body.contains(panel)) {
    document.body.appendChild(panel);
  }

  // Initialize language settings if not already done
  if (!currentSourceLang || !currentTargetLang) {
    await initializeLanguageSettings();
  }

  // Populate language dropdowns
  populateLanguageDropdowns();
  
  // Setup language search (must be after populate)
  setupLanguageSearch();
  
  // Set old selects if they exist (backward compatibility)
  const oldSourceSelect = document.getElementById('sidebar-source-lang');
  const oldTargetSelect = document.getElementById('sidebar-target-lang');
  if (oldSourceSelect) oldSourceSelect.value = currentSourceLang;
  if (oldTargetSelect) oldTargetSelect.value = currentTargetLang;
  
  // Show auto-detect info if using defaults
  const saved = await chrome.storage.sync.get(['languageAutoDetected']);
  if (!saved.languageAutoDetected) {
    const infoEl = document.getElementById('lang-auto-detect-info');
    const pageLang = LanguageHelper.detectPageLanguage();
    const pageLangName = LanguageHelper.getLanguageName(pageLang, false);
    const targetLangName = LanguageHelper.getLanguageName(currentTargetLang, false);
    
    if (infoEl) {
      document.getElementById('lang-auto-detect-text').textContent = 
        i18n('autoDetectedInfo', `${pageLangName} → ${targetLangName}`);
      infoEl.style.display = 'block';
      
      // Hide after 5 seconds
      setTimeout(() => {
        infoEl.style.display = 'none';
        chrome.storage.sync.set({ languageAutoDetected: true });
      }, 5000);
    }
  }

  // Event listeners - only setup if NOT in panel mode (panel mode will override these)
  if (!isInSidePanel) {
    const fab = document.getElementById('localizeai-expand-fab');
    if (fab) {
      fab.addEventListener('click', toggleCollapseSidebar);
    }
    
    const collapseBtn = document.getElementById('localizeai-collapse');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCollapseSidebar();
      });
    }
    
    document.getElementById('localizeai-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeSidebar();
    });
    document.getElementById('show-original').addEventListener('click', showOriginal);
    document.getElementById('show-translated').addEventListener('click', showTranslated);
    document.getElementById('clear-cache-btn').addEventListener('click', clearTranslationCache);
    document.getElementById('pseudo-loc-btn').addEventListener('click', applyPseudoLocalization);
    document.getElementById('live-edit-btn').addEventListener('click', enableLiveEdit);
    
    // Setup pseudo-loc info tooltip
    setupPseudoLocTooltip();
    
    // Setup all feature tooltips
    setupFeatureTooltips();
    document.getElementById('ai-suggest-btn').addEventListener('click', showAISuggestions);
    document.getElementById('quality-check-btn').addEventListener('click', runQualityCheck);
    document.getElementById('smart-translate-btn').addEventListener('click', smartBatchTranslate);
    document.getElementById('bug-report-btn').addEventListener('click', toggleBugReport);
    document.getElementById('view-reports-btn').addEventListener('click', showBugReportSidebar);
    document.getElementById('signin-btn').addEventListener('click', handleSignInSidebar);
    document.getElementById('upgrade-btn').addEventListener('click', showUpgradeDialog);
    document.getElementById('free-signout-btn').addEventListener('click', handleSignOutSidebar);
    document.getElementById('sync-drive-btn').addEventListener('click', handleSyncDrive);
    document.getElementById('premium-info-btn').addEventListener('click', showPremiumInfoDialog);
    document.getElementById('premium-sync-drive-btn').addEventListener('click', handleSyncDrive);
    document.getElementById('premium-signout-btn').addEventListener('click', handleSignOutSidebar);
    document.getElementById('json-translator-btn').addEventListener('click', () => {
      if (window.jsonTranslator) {
        window.jsonTranslator.showDialog();
      }
    });
  } else {
    // In panel mode, setup tooltips
    setupPseudoLocTooltip();
    setupFeatureTooltips();
    
    // Close button in panel mode just closes the window
    const closeBtn = document.getElementById('localizeai-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.close();
      });
    }
    
    // Account buttons work the same (they don't need page interaction)
    const signinBtn = document.getElementById('signin-btn');
    if (signinBtn) {
      signinBtn.addEventListener('click', handleSignInSidebar);
    }
    
    const upgradeBtn = document.getElementById('upgrade-btn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', showUpgradeDialog);
    }
    
    const freeSignoutBtn = document.getElementById('free-signout-btn');
    if (freeSignoutBtn) {
      freeSignoutBtn.addEventListener('click', handleSignOutSidebar);
    }
    
    const syncDriveBtn = document.getElementById('sync-drive-btn');
    if (syncDriveBtn) {
      syncDriveBtn.addEventListener('click', handleSyncDrive);
    }
    
    const premiumInfoBtn = document.getElementById('premium-info-btn');
    if (premiumInfoBtn) {
      premiumInfoBtn.addEventListener('click', showPremiumInfoDialog);
    }
    
    const premiumSyncBtn = document.getElementById('premium-sync-drive-btn');
    if (premiumSyncBtn) {
      premiumSyncBtn.addEventListener('click', handleSyncDrive);
    }
    
    const premiumSignoutBtn = document.getElementById('premium-signout-btn');
    if (premiumSignoutBtn) {
      premiumSignoutBtn.addEventListener('click', handleSignOutSidebar);
    }
  }

  // Load premium status
  loadPremiumStatus();
  
  // Initialize bug report DB and load stats
  bugReportDB.init().then(() => {
    updateBugReportStats();
  }).catch(err => {
    console.error('Failed to initialize bug report DB:', err);
  });

  panelInjected = true;
}

// Handle source language change
async function handleSourceLanguageChange(newSourceLang) {
  // Smart target language suggestion
  if (newSourceLang !== currentSourceLang) {
    const smartTarget = LanguageHelper.getSmartTargetLanguage(newSourceLang);
    
    // Only suggest if different from current target
    if (smartTarget !== currentTargetLang && smartTarget !== newSourceLang) {
      const smartTargetName = LanguageHelper.getLanguageName(smartTarget, false);
      const shouldSwitch = await showConfirmDialog(
        i18n('changeTargetLanguage'),
        i18n('sourceLanguageChanged', LanguageHelper.getLanguageName(newSourceLang, false), smartTargetName),
        i18n('yesChange'),
        i18n('noKeepCurrent')
      );
      
      if (shouldSwitch) {
        currentTargetLang = smartTarget;
        updateLanguageDisplay('target', smartTarget);
        await chrome.storage.sync.set({ targetLanguage: currentTargetLang });
      }
    }
  }
  
  currentSourceLang = newSourceLang;
  updateLanguageDisplay('source', newSourceLang);
  await chrome.storage.sync.set({ sourceLanguage: currentSourceLang });
  
  // Clear cache when language changes
  clearTranslationCache();
}

// Handle target language change
async function handleTargetLanguageChange(newTargetLang) {
  currentTargetLang = newTargetLang;
  updateLanguageDisplay('target', newTargetLang);
  await chrome.storage.sync.set({ targetLanguage: currentTargetLang });
  
  // Clear cache when language changes
  clearTranslationCache();
}

// Populate language dropdowns with modern UI
function populateLanguageDropdowns() {
  const sourceList = document.getElementById('source-lang-list');
  const targetList = document.getElementById('target-lang-list');
  
  if (!sourceList || !targetList) return;
  
  // Get popular languages first, then all others
  const popularLangs = LanguageHelper.getPopularLanguages();
  const allLangs = LanguageHelper.getAllLanguageCodes();
  const otherLangs = allLangs.filter(code => !popularLangs.includes(code))
    .sort((a, b) => {
      const nameA = LanguageHelper.getLanguageName(a, false);
      const nameB = LanguageHelper.getLanguageName(b, false);
      return nameA.localeCompare(nameB);
    });
  
  // Build HTML for both lists
  const buildList = (container) => {
    let html = '';
    
    // All languages (popular first, then others)
    const allLanguages = [...popularLangs, ...otherLangs];
    
    allLanguages.forEach(code => {
      const lang = LANGUAGES_CONFIG[code];
      html += `
        <div class="lang-item" data-lang-code="${code}">
          <span class="lang-item-name">${lang.name}</span>
          <span class="lang-item-code">${code.toUpperCase()}</span>
        </div>
      `;
    });
    
    container.innerHTML = html;
  };
  
  buildList(sourceList);
  buildList(targetList);
}

// Update selected language display
function updateLanguageDisplay(type, langCode) {
  const lang = LANGUAGES_CONFIG[langCode];
  if (!lang) return;
  
  const prefix = type === 'source' ? 'source' : 'target';
  const nativeEl = document.getElementById(`${prefix}-lang-native`);
  
  if (nativeEl) nativeEl.textContent = lang.name; // Use English name
  
  // Update selected state in list
  const list = document.getElementById(`${prefix}-lang-list`);
  if (list) {
    list.querySelectorAll('.lang-item').forEach(item => {
      if (item.dataset.langCode === langCode) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }
}

// Setup language search functionality
function setupLanguageSearch() {
  const sourceBtn = document.getElementById('source-lang-btn');
  const targetBtn = document.getElementById('target-lang-btn');
  const sourceDropdown = document.getElementById('source-lang-dropdown');
  const targetDropdown = document.getElementById('target-lang-dropdown');
  const sourceSearch = document.getElementById('source-lang-search');
  const targetSearch = document.getElementById('target-lang-search');
  const sourceList = document.getElementById('source-lang-list');
  const targetList = document.getElementById('target-lang-list');
  
  if (!sourceBtn || !targetBtn || !sourceDropdown || !targetDropdown) {
    console.error('[LocalizeAI] Language dropdown elements not found');
    return;
  }
  
  // Toggle dropdown
  sourceBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = sourceDropdown.style.display === 'block';
    
    // Close all dropdowns
    sourceDropdown.style.display = 'none';
    targetDropdown.style.display = 'none';
    sourceBtn.classList.remove('active');
    targetBtn.classList.remove('active');
    
    if (!isOpen) {
      sourceDropdown.style.display = 'block';
      sourceBtn.classList.add('active');
      if (sourceSearch) sourceSearch.focus();
    }
  });
  
  targetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = targetDropdown.style.display === 'block';
    
    // Close all dropdowns
    sourceDropdown.style.display = 'none';
    targetDropdown.style.display = 'none';
    sourceBtn.classList.remove('active');
    targetBtn.classList.remove('active');
    
    if (!isOpen) {
      targetDropdown.style.display = 'block';
      targetBtn.classList.add('active');
      if (targetSearch) targetSearch.focus();
    }
  });
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.lang-dropdown-wrapper')) {
      sourceDropdown.style.display = 'none';
      targetDropdown.style.display = 'none';
      sourceBtn.classList.remove('active');
      targetBtn.classList.remove('active');
    }
  });
  
  // Search functionality
  if (sourceSearch && sourceList) {
    sourceSearch.addEventListener('input', (e) => {
      filterLanguageList(e.target.value, sourceList);
    });
  }
  
  if (targetSearch && targetList) {
    targetSearch.addEventListener('input', (e) => {
      filterLanguageList(e.target.value, targetList);
    });
  }
  
  // Language selection
  if (sourceList) {
    sourceList.addEventListener('click', async (e) => {
      const item = e.target.closest('.lang-item');
      if (!item) return;
      
      const newLangCode = item.dataset.langCode;
      await handleSourceLanguageChange(newLangCode);
      
      sourceDropdown.style.display = 'none';
      sourceBtn.classList.remove('active');
      if (sourceSearch) {
        sourceSearch.value = '';
        filterLanguageList('', sourceList);
      }
    });
  }
  
  if (targetList) {
    targetList.addEventListener('click', async (e) => {
      const item = e.target.closest('.lang-item');
      if (!item) return;
      
      const newLangCode = item.dataset.langCode;
      await handleTargetLanguageChange(newLangCode);
      
      targetDropdown.style.display = 'none';
      targetBtn.classList.remove('active');
      if (targetSearch) {
        targetSearch.value = '';
        filterLanguageList('', targetList);
      }
    });
  }
  
  // Initialize displays
  if (currentSourceLang) {
    updateLanguageDisplay('source', currentSourceLang);
  }
  if (currentTargetLang) {
    updateLanguageDisplay('target', currentTargetLang);
  }
}

// Filter language list based on search query
function filterLanguageList(query, listElement) {
  const items = listElement.querySelectorAll('.lang-item');
  const groups = listElement.querySelectorAll('.lang-group-header');
  const lowerQuery = query.toLowerCase();
  
  let hasResults = false;
  let currentGroupHasResults = false;
  let currentGroup = null;
  
  items.forEach((item, index) => {
    const code = item.dataset.langCode;
    const lang = LANGUAGES_CONFIG[code];
    const searchText = `${lang.name} ${lang.nativeName} ${code}`.toLowerCase();
    
    // Check if we passed a group header
    const prevGroup = item.previousElementSibling;
    if (prevGroup && prevGroup.classList.contains('lang-group-header')) {
      // Hide previous group if it had no results
      if (currentGroup && !currentGroupHasResults) {
        currentGroup.style.display = 'none';
      }
      currentGroup = prevGroup;
      currentGroupHasResults = false;
    }
    
    if (searchText.includes(lowerQuery)) {
      item.style.display = 'flex';
      hasResults = true;
      currentGroupHasResults = true;
      if (currentGroup) currentGroup.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
  
  // Hide last group if no results
  if (currentGroup && !currentGroupHasResults) {
    currentGroup.style.display = 'none';
  }
  
  // Show/hide no results message
  let noResults = listElement.querySelector('.lang-no-results');
  if (!hasResults && query) {
    if (!noResults) {
      noResults = document.createElement('div');
      noResults.className = 'lang-no-results';
      noResults.innerHTML = `
        <img src="${chrome.runtime.getURL('icons/lucide/search.svg')}" width="32" height="32">
        <div>${i18n('noLanguagesFound')}</div>
      `;
      listElement.appendChild(noResults);
    }
    noResults.style.display = 'block';
    groups.forEach(g => g.style.display = 'none');
  } else if (noResults) {
    noResults.style.display = 'none';
  }
}

function clearTranslationCache() {
  translations.clear();
  if (isTranslated) {
    showOriginal();
  }
  updateStatus(i18n('cacheCleared'), 'success');
  showNotification(i18n('cacheCleared'), 'check-circle', 2000);
  
  // Hide clear cache button
  const clearBtn = document.getElementById('clear-cache-btn');
  if (clearBtn) {
    clearBtn.style.display = 'none';
  }
  
  // Reset status after a delay
  setTimeout(() => {
    updateStatus(i18n('readyToTranslate'), 'info');
  }, 2000);
}

function toggleCollapseSidebar() {
  const panel = document.getElementById('localizeai-panel');
  const fab = document.getElementById('localizeai-expand-fab');
  
  if (!panel) {
    return;
  }
  
  const isCollapsed = panel.classList.contains('localizeai-collapsed');
  
  if (isCollapsed) {
    // Expand
    panel.classList.remove('localizeai-collapsed');
    document.body.classList.add('localizeai-sidebar-open');
    document.documentElement.classList.add('localizeai-sidebar-open');
    if (fab) {
      fab.style.display = 'none';
      console.log('[LocalizeAI] FAB hidden');
    }
    console.log('[LocalizeAI] Expanded sidebar');
  } else {
    // Collapse
    panel.classList.add('localizeai-collapsed');
    document.body.classList.remove('localizeai-sidebar-open');
    document.documentElement.classList.remove('localizeai-sidebar-open');
    if (fab) {
      fab.style.display = 'flex';
      console.log('[LocalizeAI] FAB shown');
    }
    console.log('[LocalizeAI] Collapsed sidebar');
  }
}

function closeSidebar() {
  const panel = document.getElementById('localizeai-panel');
  const fab = document.getElementById('localizeai-expand-fab');
  
  if (!panel) return;
  
  panel.style.display = 'none';
  panel.classList.remove('localizeai-collapsed');
  
  // Hide FAB when closing completely
  if (fab) fab.style.display = 'none';
  
  // Remove body push and restore original state
  document.body.classList.remove('localizeai-sidebar-open');
  document.documentElement.classList.remove('localizeai-sidebar-open');
  
  // Disable Live Edit if active
  if (liveEditEnabled) {
    disableLiveEdit();
  }
  
  // Disable Bug Report mode if active
  if (bugReportMode) {
    disableBugReportCapture();
  }
  
  // Restore pseudo-localization if active
  if (isPseudoLocActive) {
    restorePseudoLocalization();
  }
  
  // Restore original if translated
  if (isTranslated) {
    showOriginal();
    isTranslated = false;
  }
  
  // Clear any active overlays, dialogs, notifications
  document.querySelectorAll('.localizeai-dialog, .localizeai-notification, #bug-report-sidebar').forEach(el => el.remove());
  
  // Remove any lingering highlights or overlays
  document.querySelectorAll('[data-localizeai-highlight]').forEach(el => {
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.removeAttribute('data-localizeai-highlight');
  });
  
  // Remove any editable attributes that might be left
  document.querySelectorAll('[data-localizeai-editable]').forEach(el => {
    el.removeAttribute('contenteditable');
    el.removeAttribute('data-localizeai-editable');
    el.style.outline = '';
    el.style.cursor = '';
    el.style.backgroundColor = '';
  });
  
  // Restore cursor
  document.body.style.cursor = '';
  
  // Clear translation memory to free up memory
  originalTexts.clear();
  translations.clear();
}

function showOriginal() {
  if (!isTranslated || isTranslating) return;
  
  // Stop DOM observer when showing original (save resources)
  // It will restart when user translates again
  stopDOMObserver();
  
  // Restore original text
  let restoredCount = 0;
  originalTexts.forEach((originalText, node) => {
    // Check if node still exists in DOM
    if (node.parentElement && document.body.contains(node)) {
      node.textContent = originalText;
      restoredCount++;
    }
  });
  
  isTranslated = false;
  updateToggleButton();
  updateStatus(i18n('foundTextsToTranslate', restoredCount), 'success');
}

async function showTranslated() {
  if (isTranslated || isTranslating) return;
  
  // ✅ Check authentication before translating
  const { user } = await chrome.storage.sync.get(['user']);
  if (!user) {
    showNotification(i18n('pleaseSignInToTranslate'), 'alert-triangle', 5000);
    // Show sign in prompt
    setTimeout(() => {
      const signInBtn = document.getElementById('signin-btn');
      if (signInBtn) {
        signInBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 500);
    return;
  }
  
  // Initialize DOM observer if not already running (for dynamic content)
  if (!domObserver && !isInSidePanel) {
    initDOMObserver();
  }
  
  // Check if we have cached translations
  if (translations.size > 0) {
    // Use cached translations
    let appliedCount = 0;
    translations.forEach((translatedText, node) => {
      if (node.parentElement && document.body.contains(node)) {
        node.textContent = translatedText;
        appliedCount++;
      }
    });
    
    isTranslated = true;
    updateToggleButton();
    updateStatus(i18n('foundTextsToTranslate', appliedCount), 'success');
  } else {
    // Need to translate first
    await translatePageContent(currentSourceLang, currentTargetLang);
  }
}

function updateToggleButton() {
  const originalBtn = document.getElementById('show-original');
  const translatedBtn = document.getElementById('show-translated');
  
  if (!originalBtn || !translatedBtn) return;
  
  if (isTranslated) {
    originalBtn.classList.remove('active');
    translatedBtn.classList.add('active');
  } else {
    originalBtn.classList.add('active');
    translatedBtn.classList.remove('active');
  }
}

function updateTranslationUI() {
  // Update toggle buttons
  updateToggleButton();
  
  // Update status
  updateStatus(i18n('foundTextsToTranslate', translations.size), 'success');
  
  // Show clear cache button only if not translating
  const clearBtn = document.getElementById('clear-cache-btn');
  if (clearBtn && !isTranslating) {
    clearBtn.style.display = 'flex';
  }
}

function updateStatus(message, type = 'info') {
  // Save current status for panel sync
  currentStatusMessage = message;
  currentStatusType = type;
  
  const statusEl = document.getElementById('translation-status');
  
  if (statusEl) {
    statusEl.className = `status-text ${type}`;
    
    // Map status type to icon
    const iconMap = {
      'info': 'info.svg',
      'success': 'check-circle.svg',
      'error': 'alert-triangle.svg',
      'warning': 'alert-circle.svg',
      'loading': 'loader.svg'
    };
    
    const iconName = iconMap[type] || 'info.svg';
    const shouldSpin = type === 'loading';
    
    // Update status with icon
    statusEl.innerHTML = `
      <img src="${chrome.runtime.getURL(`icons/lucide/${iconName}`)}" 
           class="status-icon ${shouldSpin ? 'spinning' : ''}" 
           width="16" 
           height="16">
      <span>${message}</span>
    `;
  }
}

async function translatePageContent(sourceLang, targetLang) {
  if (isTranslating) return;
  
  isTranslating = true;
  
  // Start shimmer effect on translated button
  const shimmer = createButtonShimmer('show-translated');
  if (shimmer) shimmer.start();
  
  updateStatus(i18n('preparing'), 'loading');
  
  // Use cached text nodes if available, otherwise scan now
  if (!textNodesCache) {
    await preScanPageContent();
  }
  
  const textNodes = textNodesCache || getTextNodes(document.body);
  
  const nodesToTranslate = [];
  
  // Collect nodes to translate
  for (const node of textNodes) {
    const text = node.textContent.trim();
    
    // Filter: meaningful text only (relaxed filter)
    if (text.length > 1 && text.length < 1000) {
      // Save original if not already saved
      if (!originalTexts.has(node)) {
        originalTexts.set(node, text);
      }
      
      // Only translate if not cached
      if (!translations.has(node)) {
        nodesToTranslate.push(node);
      }
    }
  }

  if (nodesToTranslate.length === 0 && translations.size === 0) {
    if (shimmer) shimmer.stop();
    updateStatus(i18n('noResultsFound'), 'error');
    showNotification(i18n('noResultsFound'), 'alert-triangle');
    isTranslating = false;
    return;
  }

  // If we have cached translations, use them
  if (nodesToTranslate.length === 0) {
    applyTranslations();
    isTranslated = true;
    if (shimmer) shimmer.stop();
    updateToggleButton();
    updateStatus(i18n('foundTextsToTranslate', translations.size), 'success');
    isTranslating = false;
    return;
  }

  // Translate new nodes
  updateStatus(i18n('foundTextsToTranslate', nodesToTranslate.length), 'loading');
  
  let translatedCount = 0;
  const batchSize = 15; // Translate 15 at a time for better performance
  let authError = false;
  let upgradeError = false;
  
  for (let i = 0; i < nodesToTranslate.length; i += batchSize) {
    const batch = nodesToTranslate.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(nodesToTranslate.length / batchSize);
    
    // Translate batch in parallel with error handling
    const results = await Promise.allSettled(batch.map(async (node) => {
      const text = originalTexts.get(node);
      const translatedText = await translateText(text, sourceLang, targetLang);
      translations.set(node, translatedText);
      return translatedText;
    }));
    
    // Update count after batch completes
    translatedCount += batch.length;
    
    // Update progress after translating batch
    const progressPercent = Math.round((translatedCount / nodesToTranslate.length) * 100);
    updateStatus(`${i18n('translating')} ${translatedCount}/${nodesToTranslate.length} (${progressPercent}%)`, 'loading');
    
    // Check if any translation failed due to auth or upgrade
    for (const result of results) {
      if (result.status === 'rejected') {
        if (result.reason?.message === 'Authentication required') {
          authError = true;
          break;
        }
        if (result.reason?.message === 'Usage limit reached') {
          upgradeError = true;
          break;
        }
      }
    }
    
    // Stop translation if auth or upgrade error
    if (authError || upgradeError) {
      break;
    }
  }
  
  // If auth error, stop and don't apply translations
  if (authError) {
    if (shimmer) shimmer.stop();
    isTranslating = false;
    updateStatus(i18n('pleaseSignInToTranslate'), 'warning');
    return;
  }
  
  // If upgrade error, stop and don't apply translations
  if (upgradeError) {
    if (shimmer) shimmer.stop();
    isTranslating = false;
    updateStatus(i18n('usageLimitReached'), 'error');
    return;
  }

  // Apply all translations
  applyTranslations();
  isTranslated = true;
  isTranslating = false;
  
  // Stop shimmer effect
  if (shimmer) shimmer.stop();
  
  updateToggleButton();
  updateStatus(`${i18n('complete')} - ${i18n('translated')} ${translatedCount} ${i18n('texts')}`, 'success');
  showNotification(`${i18n('translationComplete')} (${translatedCount} ${i18n('texts')})`, 'check-circle', 3000);
  
  // Show clear cache button
  const clearBtn = document.getElementById('clear-cache-btn');
  if (clearBtn) {
    clearBtn.style.display = 'flex';
  }
}

function applyTranslations() {
  translations.forEach((translatedText, node) => {
    if (node.parentElement) {
      node.textContent = translatedText;
    }
  });
}

// Pre-scan and cache all text elements on page
async function preScanPageContent() {
  if (isScanning) {
    return;
  }
  
  const now = Date.now();
  // Only rescan if cache is older than 5 seconds
  if (textNodesCache && textElementsCache && (now - lastScanTime) < 5000) {
    return;
  }
  
  isScanning = true;
  
  try {
    // Use setTimeout to yield to UI thread
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Scan text nodes
    textNodesCache = getTextNodesImproved(document.body);
    
    // Yield again
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Scan elements with text attributes (placeholders, titles, alt, aria-label)
    textElementsCache = getTextElementsImproved();
    
    lastScanTime = now;
    
    console.log(`[LocalizeAI] Scan complete: ${textNodesCache.length} text nodes, ${textElementsCache.length} text elements`);
  } catch (error) {
    console.error('[LocalizeAI] Error during page scan:', error);
  } finally {
    isScanning = false;
  }
}

// Improved text node scanner with better detection
function getTextNodesImproved(element) {
  const textNodes = [];
  const seenTexts = new Set();
  
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (!node.parentElement) return NodeFilter.FILTER_REJECT;
        
        const parent = node.parentElement;
        const text = node.textContent.trim();
        
        // Must have text (at least 1 character)
        if (!text || text.length === 0) return NodeFilter.FILTER_REJECT;
        
        // Skip our extension elements
        let checkElement = parent;
        while (checkElement) {
          if (checkElement.id === 'localizeai-panel' || 
              checkElement.classList?.contains('localizeai-sidebar') ||
              checkElement.classList?.contains('localizeai-notification') ||
              checkElement.classList?.contains('localizeai-dialog') ||
              checkElement.classList?.contains('localizeai-modal')) {
            return NodeFilter.FILTER_REJECT;
          }
          checkElement = checkElement.parentElement;
        }
        
        // Skip script, style, noscript, iframe
        const tagName = parent.tagName;
        if (tagName === 'SCRIPT' || 
            tagName === 'STYLE' ||
            tagName === 'NOSCRIPT' ||
            tagName === 'IFRAME' ||
            tagName === 'SVG') {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip hidden elements
        try {
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || 
              style.visibility === 'hidden' || 
              parseFloat(style.opacity) === 0) {
            return NodeFilter.FILTER_REJECT;
          }
        } catch (e) {
          // If getComputedStyle fails, still accept
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;
  let totalChecked = 0;
  while (node = walker.nextNode()) {
    totalChecked++;
    const text = node.textContent.trim();
    
    // Accept all text nodes, even duplicates (they might be in different contexts)
    if (text.length > 0) {
      textNodes.push(node);
      seenTexts.add(text);
    }
  }
  
  return textNodes;
}

// Scan elements with text attributes
function getTextElementsImproved() {
  const elements = [];
  const selectors = [
    'input[placeholder]',
    'textarea[placeholder]',
    '[title]',
    'img[alt]',
    '[aria-label]',
    '[aria-placeholder]',
    '[data-tooltip]',
    '[data-title]'
  ];
  
  selectors.forEach(selector => {
    try {
      const found = document.querySelectorAll(selector);
      found.forEach(el => {
        // Skip our extension elements
        if (el.closest('#localizeai-panel, .localizeai-sidebar, .localizeai-notification, .localizeai-dialog, .localizeai-modal')) {
          return;
        }
        
        elements.push(el);
      });
    } catch (e) {
      // Silently skip problematic selectors
    }
  });
  
  return elements;
}

// Get cached or fresh text nodes
function getTextNodes(element) {
  // If we have cache and it's recent, use it
  if (textNodesCache && (Date.now() - lastScanTime) < 5000) {
    console.log('[LocalizeAI] Using cached text nodes');
    return textNodesCache;
  }
  
  // Otherwise, scan now (fallback for old code paths)
  return getTextNodesImproved(element || document.body);
}

async function translateText(text, sourceLang, targetLang, retries = 3) {
  // ✅ USE FREE CLIENT-SIDE GOOGLE TRANSLATE API
  // No authentication required, runs entirely on user's machine
  
  try {
    // Use the free client-side translation API
    if (window.translateClient) {
      console.log('[LocalizeAI] Translating text:', text.substring(0, 50), '...');
      const translatedText = await window.translateClient.translateWithRetry(
        text, 
        targetLang, 
        sourceLang || 'auto',
        retries
      );
      console.log('[LocalizeAI] Translation result:', translatedText.substring(0, 50), '...');
      return translatedText;
    } else {
      console.error('[LocalizeAI] TranslateClient not initialized!');
      console.error('[LocalizeAI] window.translateClient:', window.translateClient);
      showNotification(i18n('translationClientNotInitialized'), 'alert-triangle');
      return text;
    }
  } catch (error) {
    console.error('[LocalizeAI] Translation failed:', error);
    
    // Show error notification once
    if (!window.localizeAITranslationErrorShown) {
      showNotification(i18n('translationFailed') + ': ' + error.message, 'alert-triangle');
      window.localizeAITranslationErrorShown = true;
    }
    
    // Return original text on error
    return text;
  }
}

function highlightElement(element) {
  element.style.outline = '2px solid #667eea';
  element.style.outlineOffset = '2px';
  setTimeout(() => {
    element.style.outline = '';
    element.style.outlineOffset = '';
  }, 2000);
}

// Pseudo-Localization
let isPseudoLocActive = false;

function setupPseudoLocTooltip() {
  const trigger = document.querySelector('.pseudo-loc-info-trigger');
  const tooltip = document.querySelector('.pseudo-loc-tooltip');
  
  if (!trigger || !tooltip) return;
  
  trigger.addEventListener('mouseenter', (e) => {
    const rect = trigger.getBoundingClientRect();
    
    // Show tooltip first to measure its actual height
    tooltip.style.display = 'block';
    tooltip.style.visibility = 'hidden';
    
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;
    
    // Calculate position - prioritize left side with gap
    let left = rect.left - tooltipWidth - 16; // 16px gap from icon
    let top = rect.top - 8; // Align slightly above icon
    
    // If tooltip goes off left edge, try showing above
    if (left < 10) {
      // Show above icon
      left = rect.left - tooltipWidth + rect.width;
      top = rect.top - tooltipHeight - 12;
      
      // If still goes off left, align with left edge
      if (left < 10) {
        left = 10;
      }
      
      // If goes off top, show below instead
      if (top < 10) {
        top = rect.bottom + 12;
      }
    }
    
    // If tooltip goes off right edge, align with right edge of viewport
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth - 10;
    }
    
    // Adjust vertical position to keep tooltip in viewport
    if (top + tooltipHeight > window.innerHeight - 10) {
      top = window.innerHeight - tooltipHeight - 10;
    }
    if (top < 10) {
      top = 10;
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.visibility = 'visible';
  });
  
  trigger.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });
}

function setupFeatureTooltips() {
  const triggers = document.querySelectorAll('.feature-info-trigger');
  
  triggers.forEach(trigger => {
    const tooltip = trigger.querySelector('.feature-tooltip');
    if (!tooltip) return;
    
    trigger.addEventListener('mouseenter', (e) => {
      const rect = trigger.getBoundingClientRect();
      
      // Show tooltip first to measure its actual height
      tooltip.style.display = 'block';
      tooltip.style.visibility = 'hidden';
      
      const tooltipRect = tooltip.getBoundingClientRect();
      const tooltipWidth = tooltipRect.width;
      const tooltipHeight = tooltipRect.height;
      
      // Calculate position - prioritize left side with gap
      let left = rect.left - tooltipWidth - 16; // 16px gap from icon
      let top = rect.top - 8; // Align slightly above icon
      
      // If tooltip goes off left edge, try showing above
      if (left < 10) {
        // Show above icon
        left = rect.left - tooltipWidth + rect.width;
        top = rect.top - tooltipHeight - 12;
        
        // If still goes off left, align with left edge
        if (left < 10) {
          left = 10;
        }
        
        // If goes off top, show below instead
        if (top < 10) {
          top = rect.bottom + 12;
        }
      }
      
      // If tooltip goes off right edge, align with right edge of viewport
      if (left + tooltipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth - 10;
      }
      
      // Adjust vertical position to keep tooltip in viewport
      if (top + tooltipHeight > window.innerHeight - 10) {
        top = window.innerHeight - tooltipHeight - 10;
      }
      if (top < 10) {
        top = 10;
      }
      
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.style.visibility = 'visible';
    });
    
    trigger.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

async function applyPseudoLocalization() {
  const btn = document.getElementById('pseudo-loc-btn');
  
  // Toggle: if already applied, restore
  if (isPseudoLocActive) {
    restorePseudoLocalization();
    return;
  }

  // Use cached text nodes if available, otherwise scan synchronously
  // Don't await to avoid blocking UI
  if (!textNodesCache) {
    preScanPageContent(); // Fire and forget
  }
  
  const textNodes = textNodesCache || getTextNodes(document.body);
  let processedCount = 0;

  textNodes.forEach(node => {
    const text = node.textContent.trim();
    if (text.length > 0) {
      originalTexts.set(node, text);
      node.textContent = pseudoLocalize(text);
      processedCount++;
    }
  });

  isPseudoLocActive = true;
  
  // Update button UI - subtle green style
  if (btn) {
    btn.innerHTML = `
      <img src="${chrome.runtime.getURL('icons/lucide/rotate-ccw.svg')}" class="btn-icon-sm" width="16" height="16">
      <span>${i18n('removePseudoLoc')}</span>
      <span class="pseudo-loc-badge">${processedCount}</span>
    `;
    btn.classList.add('pseudo-loc-active');
  }
  
  showNotification(i18n('foundTextsToTranslate', processedCount), 'check-circle');
}

function restorePseudoLocalization() {
  const btn = document.getElementById('pseudo-loc-btn');
  let restoredCount = 0;
  
  originalTexts.forEach((originalText, node) => {
    if (node.parentElement && document.body.contains(node)) {
      node.textContent = originalText;
      restoredCount++;
    }
  });
  
  originalTexts.clear();
  isPseudoLocActive = false;
  
  // Restore button UI
  if (btn) {
    btn.innerHTML = `
      <img src="${chrome.runtime.getURL('icons/lucide/sliders.svg')}" class="btn-icon-sm" width="16" height="16">
      <span>${i18n('applyPseudoLoc')}</span>
    `;
    btn.classList.remove('pseudo-loc-active');
  }
  
  showNotification(i18n('foundTextsToTranslate', restoredCount), 'rotate-ccw');
}

function pseudoLocalize(text) {
  // Enhanced character map with more accented characters
  const charMap = {
    'a': 'ȧ', 'b': 'ƀ', 'c': 'ƈ', 'd': 'ḓ', 'e': 'ḗ', 
    'f': 'ƒ', 'g': 'ɠ', 'h': 'ħ', 'i': 'ī', 'j': 'ĵ',
    'k': 'ķ', 'l': 'ŀ', 'm': 'ḿ', 'n': 'ƞ', 'o': 'ǿ',
    'p': 'ƥ', 'q': 'ɋ', 'r': 'ř', 's': 'ş', 't': 'ŧ',
    'u': 'ŭ', 'v': 'ṽ', 'w': 'ẇ', 'x': 'ẋ', 'y': 'ẏ', 'z': 'ẑ',
    'A': 'Ȧ', 'B': 'Ɓ', 'C': 'Ƈ', 'D': 'Ḓ', 'E': 'Ḗ',
    'F': 'Ƒ', 'G': 'Ɠ', 'H': 'Ħ', 'I': 'Ī', 'J': 'Ĵ',
    'K': 'Ķ', 'L': 'Ŀ', 'M': 'Ḿ', 'N': 'Ƞ', 'O': 'Ǿ',
    'P': 'Ƥ', 'Q': 'Ɋ', 'R': 'Ř', 'S': 'Ş', 'T': 'Ŧ',
    'U': 'Ŭ', 'V': 'Ṽ', 'W': 'Ẇ', 'X': 'Ẋ', 'Y': 'Ẏ', 'Z': 'Ẑ'
  };

  // Replace characters with accented versions
  let result = text.split('').map(char => charMap[char] || char).join('');
  
  // Add expansion to simulate longer languages (German, Russian, etc.)
  // Typically 30-40% longer
  const expansionChars = '··';
  const wordsCount = text.split(/\s+/).length;
  const expansion = expansionChars.repeat(Math.max(1, Math.floor(wordsCount * 0.4)));
  
  // Add brackets and expansion
  return `[!!! ${result}${expansion} !!!]`;
}

function restoreOriginalTexts() {
  originalTexts.forEach((originalText, node) => {
    if (node.parentElement) {
      node.textContent = originalText;
    }
  });
  originalTexts.clear();
  isPseudoLocActive = false;
}

// Live Edit Mode
let liveEditEnabled = false;
let editableElements = new Set();
let liveEditChanges = new Map(); // Track all changes

// Simple click blocker for links and buttons
function blockInteractiveClick(e) {
  // Skip LocalizeAI panel
  if (e.target.closest('#localizeai-panel')) {
    return;
  }
  
  // Check if clicked element or any parent is a link or button
  const interactive = e.target.closest('a[href], button, [role="button"], [role="link"], [onclick]');
  
  if (interactive) {
    // Only block click to prevent navigation, allow mousedown/mouseup for editing
    if (e.type === 'click') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }
}

// Block all interactive elements on the page
function blockAllInteractiveElements() {
  // Only block click events - allow mousedown/mouseup for text selection and editing
  document.addEventListener('click', blockInteractiveClick, true);
  
  console.log('[LocalizeAI] Interactive elements blocked');
}

// Unblock all interactive elements
function unblockAllInteractiveElements() {
  document.removeEventListener('click', blockInteractiveClick, true);
  
  console.log('[LocalizeAI] Interactive elements unblocked');
}

async function enableLiveEdit() {
  if (liveEditEnabled) {
    // Disable Live Edit
    disableLiveEdit();
    return;
  }

  liveEditEnabled = true;
  
  // Block ALL interactive elements on the page first
  blockAllInteractiveElements();
  
  // Use cached text nodes if available, otherwise scan synchronously
  // Don't await to avoid blocking UI
  if (!textNodesCache) {
    preScanPageContent(); // Fire and forget
  }
  
  const textNodes = textNodesCache || getTextNodes(document.body);

  textNodes.forEach(node => {
    const element = node.parentElement;
    
    // Skip if already editable
    if (element.hasAttribute('data-localizeai-editable')) {
      return;
    }
    
    // Make ALL text elements editable, including those in links/buttons
    element.setAttribute('contenteditable', 'true');
    element.setAttribute('data-localizeai-editable', 'true');
    element.setAttribute('data-localizeai-original', element.textContent.trim());
    
    // Add hover effect instead of permanent outline
    element.style.cursor = 'text';
    element.style.transition = 'outline 0.2s, background-color 0.2s';
    
    element.addEventListener('mouseenter', handleEditableHover);
    element.addEventListener('mouseleave', handleEditableLeave);
    element.addEventListener('focus', handleEditableFocus);
    element.addEventListener('blur', handleEditableBlur);
    element.addEventListener('keydown', handleEditableKeydown);
    
    editableElements.add(element);
  });

  // Update button text (only if not in side panel)
  if (!isInSidePanel) {
    const liveEditBtn = document.getElementById('live-edit-btn');
    
    if (liveEditBtn) {
      liveEditBtn.innerHTML = `
        <svg class="btn-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
        <span>${i18n('disableLiveEdit', liveEditChanges.size)}</span>
      `;
      liveEditBtn.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
      liveEditBtn.style.borderColor = '#3b82f6';
      liveEditBtn.style.color = '#1e40af';
      liveEditBtn.title = i18n('clickToDisableEditing');
    }
  }

  // Add keyboard listener for Ctrl+E to export
  document.addEventListener('keydown', handleLiveEditGlobalKeydown);
  
  // Show notification about blocked elements and live edit mode
  const blockedCount = blockedElements.size;
  if (blockedCount > 0) {
    showNotification(
      i18n('liveEditModeActive') || `Live Edit Mode: ${blockedCount} interactive elements blocked. Click text to edit.`,
      'edit',
      4000
    );
  }
  
  // Show notification about export shortcut if there are changes
  if (liveEditChanges.size > 0) {
    setTimeout(() => {
      showNotification(i18n('tipPressCtrlE'), 'info', 3000);
    }, 4000);
  }
}

function disableLiveEdit() {
  liveEditEnabled = false;
  
  // Unblock all interactive elements
  unblockAllInteractiveElements();
  
  // Don't show export dialog - just disable and keep changes visible
  // User can manually export if needed via Ctrl+E
  
  editableElements.forEach(element => {
    element.removeAttribute('contenteditable');
    element.removeAttribute('data-localizeai-editable');
    element.style.outline = '';
    element.style.cursor = '';
    element.style.transition = '';
    element.style.backgroundColor = '';
    
    element.removeEventListener('mouseenter', handleEditableHover);
    element.removeEventListener('mouseleave', handleEditableLeave);
    element.removeEventListener('focus', handleEditableFocus);
    element.removeEventListener('blur', handleEditableBlur);
    element.removeEventListener('keydown', handleEditableKeydown);
  });
  
  editableElements.clear();
  document.removeEventListener('keydown', handleLiveEditGlobalKeydown);

  // Update button text (only if not in side panel)
  if (!isInSidePanel) {
    const liveEditBtn = document.getElementById('live-edit-btn');
    
    if (liveEditBtn) {
      const hasChanges = liveEditChanges.size > 0;
      liveEditBtn.innerHTML = `
        <svg class="btn-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9m-9-4h9m-9-4h9M5 20h.01M5 16h.01M5 12h.01m-.6 8h1.2c.56 0 .84 0 1.054-.109a1 1 0 0 0 .437-.437C7.2 19.24 7.2 18.96 7.2 18.4v-1.2c0-.56 0-.84-.109-1.054a1 1 0 0 0-.437-.437C6.44 15.6 6.16 15.6 5.6 15.6H4.4c-.56 0-.84 0-1.054.109a1 1 0 0 0-.437.437C2.8 16.36 2.8 16.64 2.8 17.2v1.2c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437C3.56 20 3.84 20 4.4 20Zm0-8h1.2c.56 0 .84 0 1.054-.109a1 1 0 0 0 .437-.437C7.2 11.24 7.2 10.96 7.2 10.4V9.2c0-.56 0-.84-.109-1.054a1 1 0 0 0-.437-.437C6.44 7.6 6.16 7.6 5.6 7.6H4.4c-.56 0-.84 0-1.054.109a1 1 0 0 0-.437.437C2.8 8.36 2.8 8.64 2.8 9.2v1.2c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437C3.56 12 3.84 12 4.4 12Z"/>
        </svg>
        <span>${hasChanges ? i18n('enableLiveEditSaved', liveEditChanges.size) : i18n('enableLiveEdit')}</span>
      `;
      liveEditBtn.style.background = '';
      liveEditBtn.style.borderColor = '';
      liveEditBtn.style.color = '';
      liveEditBtn.title = hasChanges ? i18n('clickToEnableEditingWithChanges') : i18n('clickToEnableEditing');
    }
  }
  
  // Show notification about saved changes
  if (liveEditChanges.size > 0) {
    showNotification(i18n('changesSaved', liveEditChanges.size), 'check-circle', 3000);
  }
}

function preventDefaultClick(e) {
  // Simple blocker - not used anymore but kept for compatibility
  return false;
}

function handleEditableHover(e) {
  if (liveEditEnabled) {
    e.target.style.outline = '2px dashed #667eea';
    e.target.style.backgroundColor = '#667eea08';
  }
}

function handleEditableLeave(e) {
  if (liveEditEnabled && document.activeElement !== e.target) {
    e.target.style.outline = '';
    e.target.style.backgroundColor = '';
  }
}

function handleEditableFocus(e) {
  if (liveEditEnabled) {
    e.target.style.outline = '2px solid #667eea';
    e.target.style.backgroundColor = '#667eea15';
  }
}

function handleEditableBlur(e) {
  if (liveEditEnabled) {
    const element = e.target;
    const originalText = element.getAttribute('data-localizeai-original');
    const newText = element.textContent.trim();
    
    element.style.outline = '';
    element.style.backgroundColor = '';
    
    // Auto-save if text changed
    if (newText !== originalText && newText.length > 0) {
      element.setAttribute('data-localizeai-original', newText);
      
      // Track change
      const elementPath = getElementPath(element);
      liveEditChanges.set(elementPath, {
        original: originalText,
        edited: newText,
        element: element.tagName.toLowerCase(),
        timestamp: new Date().toISOString()
      });
      
      // Update button counter
      const liveEditBtn = document.getElementById('live-edit-btn');
      
      if (liveEditBtn) {
        liveEditBtn.innerHTML = `
          <svg class="btn-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
          <span>Disable Live Edit (${liveEditChanges.size} edits)</span>
        `;
      }
    }
  }
}

function handleEditableKeydown(e) {
  // Ctrl+Z to undo
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    const element = e.target;
    const originalText = element.getAttribute('data-localizeai-original');
    element.textContent = originalText;
  }
  
  // Enter to save and blur
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    e.target.blur();
  }
}

function handleLiveEditGlobalKeydown(e) {
  // Ctrl+E to export changes
  if (e.ctrlKey && e.key === 'e' && liveEditEnabled) {
    e.preventDefault();
    if (liveEditChanges.size > 0) {
      showExportChangesDialog();
    }
  }
}

function getElementPath(element) {
  const path = [];
  let current = element;
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className) {
      const classes = current.className.split(' ').filter(c => c && !c.includes('localizeai'));
      if (classes.length > 0) {
        selector += `.${classes[0]}`;
      }
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

function showExportChangesDialog() {
  // LARGE DIALOG - Always show on page with full-screen overlay
  if (isInSidePanel) {
    console.warn('[Panel] Large dialogs should be shown on page, not in panel');
    return;
  }
  
  const changesArray = Array.from(liveEditChanges.entries());
  
  const csvContent = [
    'Element Path,Original Text,Edited Text,Element Type,Timestamp',
    ...changesArray.map(([path, data]) => 
      `"${path}","${data.original.replace(/"/g, '""')}","${data.edited.replace(/"/g, '""')}","${data.element}","${data.timestamp}"`
    )
  ].join('\n');
  
  const jsonContent = JSON.stringify(
    changesArray.map(([path, data]) => ({ path, ...data })),
    null,
    2
  );
  
  const dialog = document.createElement('div');
  dialog.className = 'localizeai-dialog';
  dialog.innerHTML = `
    <div class="dialog-content" style="max-width: 700px;">
      <h4 style="display: flex; align-items: center; gap: 8px;">
        <img src="${chrome.runtime.getURL('icons/lucide/upload.svg')}" width="20" height="20">
        ${i18n('exportChanges', liveEditChanges.size)}
      </h4>
      <p style="font-size: 13px; color: #666; margin-bottom: 15px;">
        ${i18n('exportEditsDesc')}
      </p>
      
      <div style="background: #f8f9fa; border-radius: 10px; padding: 15px; margin-bottom: 15px; max-height: 300px; overflow-y: auto;">
        ${changesArray.map(([path, data]) => `
          <div style="margin-bottom: 12px; padding: 10px; background: white; border-radius: 8px; border-left: 3px solid #667eea;">
            <div style="font-size: 11px; color: #999; margin-bottom: 4px;">${data.element} - ${path.split(' > ').slice(-2).join(' > ')}</div>
            <div style="font-size: 12px; color: #ff8787; margin-bottom: 4px;"><s>${data.original}</s></div>
            <div style="font-size: 13px; color: #28a745; font-weight: 600;">${data.edited}</div>
          </div>
        `).join('')}
      </div>
      
      <div style="display: flex; gap: 10px; margin-bottom: 10px;">
        <button id="localizeai-export-csv" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <img src="${chrome.runtime.getURL('icons/lucide/bar-chart.svg')}" width="16" height="16" style="filter: brightness(0) invert(1);">
          ${i18n('downloadCSV')}
        </button>
        <button id="localizeai-export-json" style="flex: 1; padding: 10px; background: #667eea; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <img src="${chrome.runtime.getURL('icons/lucide/file-json.svg')}" width="16" height="16" style="filter: brightness(0) invert(1);">
          ${i18n('downloadJSON')}
        </button>
      </div>
      
      <button id="localizeai-close-export" style="width: 100%; padding: 10px; background: #e0e0e0; color: #333; border: none; border-radius: 10px; cursor: pointer;">
        ${i18n('close')}
      </button>
    </div>
  `;
  document.body.appendChild(dialog);

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.remove();
  });

  document.getElementById('localizeai-export-csv').addEventListener('click', () => {
    downloadFile(csvContent, 'localizeai-edits.csv', 'text/csv');
  });

  document.getElementById('localizeai-export-json').addEventListener('click', () => {
    downloadFile(jsonContent, 'localizeai-edits.json', 'application/json');
  });

  document.getElementById('localizeai-close-export').addEventListener('click', () => {
    dialog.remove();
  });
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// AI Suggestions
async function showAISuggestions(skipShimmer = false) {
  // Check premium status FIRST before any action
  const { apiKey, user } = await chrome.storage.sync.get(['apiKey', 'user']);
  
  // Check if user is signed in first
  if (!user) {
    showNotification(i18n('pleaseSignInFirst'), 'alert-triangle', 3000);
    // Scroll to sign in button in panel
    setTimeout(() => {
      const signInBtn = document.getElementById('signin-btn');
      if (signInBtn) {
        signInBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 500);
    return;
  }
  
  // Check if user has premium
  if (!apiKey || !user?.isPremium) {
    showNotification(i18n('upgradeToPremium'), 'crown', 3000);
    setTimeout(() => showUpgradeDialog(), 500);
    return;
  }
  
  // If in panel, start shimmer and send action to page
  if (isInSidePanel) {
    
    // Start shimmer in panel
    const shimmer = createButtonShimmer('ai-suggest-btn');
    if (shimmer) {
      console.log('[AI Suggestions] Shimmer created in panel, starting animation...');
      shimmer.start();
      activeShimmers['ai-suggest-btn'] = shimmer;
    }
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'aiSuggestions', fromPanel: true });
      // Shimmer will be stopped when page sends completion message
      return;
    } catch (error) {
      console.error('Failed to trigger AI suggestions on page:', error);
      if (shimmer) shimmer.stop();
      activeShimmers['ai-suggest-btn'] = null;
      showNotification(i18n('pleaseSelectTextFirst'), 'alert-triangle');
      return;
    }
  }
  
  // Running on page
  console.log('[AI Suggestions] Running on page, skipShimmer:', skipShimmer);
  
  // Only create shimmer if not skipped (i.e., not called from panel message)
  let shimmer = null;
  if (!skipShimmer) {
    shimmer = createButtonShimmer('ai-suggest-btn');
    if (shimmer) {
      console.log('[AI Suggestions] Shimmer created on page, starting animation...');
      shimmer.start();
    }
  }
  
  // Save the current state of fromPanel flag
  const isFromPanel = currentActionFromPanel;
  
  const selection = window.getSelection().toString().trim();
  if (!selection) {
    // Stop shimmer if no text selected
    if (shimmer) shimmer.stop();
    
    // Show notification on page OR send to panel
    if (!isFromPanel) {
      showNotification(i18n('noTextSelected'), 'alert-triangle', 3000);
    } else {
      // Send notification to panel
      try {
        await chrome.runtime.sendMessage({
          action: 'showNotificationInPanel',
          message: i18n('noTextSelected'),
          iconName: 'alert-triangle',
          duration: 3000
        });
      } catch (e) {
        console.error('Failed to send notification to panel:', e);
      }
    }
    return;
  }

  // Get rich context from selected element
  const selectionObj = window.getSelection();
  const selectedElement = selectionObj.anchorNode?.parentElement;
  
  // Determine element context
  let elementType = 'text';
  let elementContext = '';
  
  if (selectedElement) {
    const tagName = selectedElement.tagName?.toLowerCase();
    
    // Identify element type for better context
    if (tagName === 'button' || selectedElement.closest('button')) {
      elementType = 'button';
      elementContext = 'Button text - should be concise and action-oriented';
    } else if (tagName === 'a' || selectedElement.closest('a')) {
      elementType = 'link';
      elementContext = 'Link text - should be clear and descriptive';
    } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      elementType = 'heading';
      elementContext = `${tagName.toUpperCase()} heading - should be clear and attention-grabbing`;
    } else if (tagName === 'label' || selectedElement.closest('label')) {
      elementType = 'label';
      elementContext = 'Form label - should be clear and concise';
    } else if (tagName === 'input' && selectedElement.placeholder) {
      elementType = 'placeholder';
      elementContext = 'Input placeholder - should be helpful and brief';
    } else if (tagName === 'li' || selectedElement.closest('li')) {
      elementType = 'menu-item';
      elementContext = 'Menu or list item - should be concise';
    } else if (tagName === 'p') {
      elementType = 'paragraph';
      elementContext = 'Paragraph text - can be more descriptive';
    } else {
      elementContext = 'UI text element';
    }
    
    // Get surrounding context (siblings text for better understanding)
    const parent = selectedElement.parentElement;
    if (parent) {
      const siblings = Array.from(parent.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE)
        .map(node => node.textContent?.trim())
        .filter(text => text && text.length > 0 && text.length < 100)
        .slice(0, 3);
      
      if (siblings.length > 1) {
        elementContext += `. Nearby text: "${siblings.join(' | ')}"`;
      }
    }
  }

  if (!isFromPanel) {
    showNotification(i18n('preparing'), 'sparkles');
  }

  try {
    const sourceLangName = LanguageHelper.getLanguageName(currentSourceLang || 'en', false);
    
    const response = await fetch('https://localizeai-285680531861.us-central1.run.app/api/ai-suggest', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ 
        text: selection,
        language: currentSourceLang || 'en',
        context: elementContext,
        elementType: elementType,
        pageTitle: document.title,
        pageUrl: window.location.hostname
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      if (shimmer) shimmer.stop();
      if (isFromPanel) await stopPanelShimmer('ai-suggest-btn');
      if (!isFromPanel) {
        showNotification(i18n('noResultsFound'), 'x-circle');
      }
      return;
    }
    
    const data = await response.json();
    if (shimmer) shimmer.stop();
    if (isFromPanel) await stopPanelShimmer('ai-suggest-btn');
    showSuggestionsDialog(
      selection, 
      data.suggestions || [i18n('noResultsFound')],
      sourceLangName,
      elementType,
      elementContext
    );
  } catch (error) {
    console.error('AI suggestion error:', error);
    if (shimmer) shimmer.stop();
    if (isFromPanel) await stopPanelShimmer('ai-suggest-btn');
    if (!isFromPanel) {
      showNotification(i18n('noResultsFound'), 'x-circle');
    }
  }
}

function showSuggestionsDialog(originalText, suggestions, language, elementType, context) {
  // LARGE DIALOG - Always show on page with full-screen overlay
  if (isInSidePanel) {
    console.warn('[Panel] Large dialogs should be shown on page, not in panel');
    return;
  }
  
  const dialog = document.createElement('div');
  dialog.className = 'localizeai-dialog';
  
  // Get element type icon
  const elementIcons = {
    'button': 'square',
    'link': 'link',
    'heading': 'heading',
    'label': 'tag',
    'placeholder': 'type',
    'menu-item': 'menu',
    'paragraph': 'align-left',
    'text': 'file-text'
  };
  const elementIcon = elementIcons[elementType] || 'file-text';
  
  dialog.innerHTML = `
    <div class="dialog-content" style="max-width: 580px; max-height: 85vh; overflow-y: auto; border-radius: 20px; scrollbar-width: none; -ms-overflow-style: none;">
      <style>
        .dialog-content::-webkit-scrollbar { display: none; }
      </style>
      
      <!-- Header -->
      <div style="text-align: center; padding-bottom: 16px; border-bottom: 1px solid #f0f0f0;">
        <div style="width: 48px; height: 48px; margin: 0 auto 12px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 14px; display: flex; align-items: center; justify-content: center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
          </svg>
        </div>
        <h3 style="font-size: 18px; font-weight: 700; color: #1a1a1a; margin: 0 0 6px 0;">AI Writing Suggestions</h3>
        <p style="font-size: 12px; color: #999; margin: 0;">Powered by Google Vertex AI Gemini</p>
      </div>
      
      <!-- Original Text -->
      <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 14px; border-radius: 14px; margin: 16px 0;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <div style="width: 24px; height: 24px; background: white; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <span style="font-size: 11px; color: #3b82f6; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Selected Text (${language})</span>
        </div>
        <div style="font-size: 14px; color: #1a1a1a; font-weight: 500; line-height: 1.5;">${originalText}</div>
      </div>
      
      <!-- Context Info -->
      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 12px; border-radius: 14px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <strong style="font-size: 11px; color: #92400e; font-weight: 700;">Context</strong>
        </div>
        <div style="font-size: 12px; color: #78350f; line-height: 1.4;">${context.split('.')[0]}</div>
      </div>
      
      <!-- Suggestions -->
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18l6-6-6-6"></path>
          </svg>
          <span style="font-size: 11px; color: #3b82f6; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Better Alternatives</span>
        </div>
        <div class="suggestions-list">
          ${suggestions.map((s, i) => `
            <div class="suggestion-item" style="padding: 14px; background: white; border: 2px solid #f0f0f0; border-radius: 14px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s; position: relative;" 
                 onmouseover="this.style.background='#f0f9ff'; this.style.borderColor='#3b82f6'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.15)';" 
                 onmouseout="this.style.background='white'; this.style.borderColor='#f0f0f0'; this.style.transform='translateY(0)'; this.style.boxShadow='none';"
                 onclick="navigator.clipboard.writeText('${s.replace(/'/g, "\\'")}'); showNotification(i18n('copiedToClipboard'), 'check-circle'); this.querySelector('.copy-indicator').style.display='inline-flex';">
              <div style="display: flex; align-items: start; gap: 10px;">
                <span style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; width: 28px; height: 28px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);">${i + 1}</span>
                <div style="flex: 1;">
                  <div style="font-size: 14px; color: #1a1a1a; line-height: 1.5; margin-bottom: 4px; font-weight: 500;">${s}</div>
                  <div style="font-size: 11px; color: #999; display: flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Click to copy
                  </div>
                </div>
                <span class="copy-indicator" style="display: none; color: #10b981; font-size: 11px; align-items: center; gap: 4px; font-weight: 600;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Copied
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <button id="localizeai-close-suggestions" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 14px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
        Close
      </button>
    </div>
  `;
  document.body.appendChild(dialog);

  // Close on overlay click
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });

  document.getElementById('localizeai-close-suggestions').addEventListener('click', () => {
    dialog.remove();
  });
}

// AI Quality Check
async function runQualityCheck(skipShimmer = false) {
  // Check premium status FIRST before any action
  const { apiKey, user } = await chrome.storage.sync.get(['apiKey', 'user']);
  
  // Check if user is signed in first
  if (!user) {
    showNotification(i18n('pleaseSignInFirst'), 'alert-triangle', 3000);
    // Scroll to sign in button in panel
    setTimeout(() => {
      const signInBtn = document.getElementById('signin-btn');
      if (signInBtn) {
        signInBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 500);
    return;
  }
  
  // Check if user has premium
  if (!apiKey || !user?.isPremium) {
    showNotification(i18n('upgradeToPremium'), 'crown', 3000);
    setTimeout(() => showUpgradeDialog(), 500);
    return;
  }
  
  // If in panel, start shimmer and send action to page
  if (isInSidePanel) {
    console.log('[Quality Check] Running in panel mode');
    
    // Start shimmer in panel
    const shimmer = createButtonShimmer('quality-check-btn');
    if (shimmer) {
      console.log('[Quality Check] Shimmer created in panel, starting animation...');
      shimmer.start();
      activeShimmers['quality-check-btn'] = shimmer;
    }
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'qualityCheck', fromPanel: true });
      // Shimmer will be stopped when page sends completion message
      return;
    } catch (error) {
      console.error('Failed to trigger quality check on page:', error);
      if (shimmer) shimmer.stop();
      activeShimmers['quality-check-btn'] = null;
      showNotification(i18n('qualityCheckError'), 'alert-triangle');
      return;
    }
  }
  
  // Running on page
  console.log('[Quality Check] Running on page, skipShimmer:', skipShimmer);
  
  // Only create shimmer if not skipped (i.e., not called from panel message)
  let shimmer = null;
  if (!skipShimmer) {
    shimmer = createButtonShimmer('quality-check-btn');
    if (shimmer) {
      console.log('[Quality Check] Shimmer created on page, starting animation...');
      shimmer.start();
    }
  }

  // Save the current state of fromPanel flag
  const isFromPanel = currentActionFromPanel;

  // Check SOURCE text quality (no translation needed)
  const sourceTexts = [];
  const nodeMap = new Map();
  
  let index = 0;
  
  // Use cached text nodes if available
  if (!textNodesCache) {
    await preScanPageContent();
  }
  
  const textNodes = textNodesCache || getTextNodes(document.body);
  
  // Collect all visible text from cached nodes
  textNodes.forEach(node => {
    const text = node.textContent.trim();
    if (text && text.length >= 3) {
      const parent = node.parentElement;
      if (!parent) return;
      
      // Skip script, style, and hidden elements
      const tagName = parent.tagName?.toLowerCase();
      if (['script', 'style', 'noscript', 'iframe'].includes(tagName)) {
        return;
      }
      
      try {
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return;
        }
      } catch (e) {
        // Continue if getComputedStyle fails
      }
      
      sourceTexts.push({
        text,
        element: parent.tagName?.toLowerCase() || 'text',
        role: parent.getAttribute('role'),
        className: parent.className
      });
      
      nodeMap.set(index, node);
      index++;
    }
  });

  if (sourceTexts.length === 0) {
    if (!isFromPanel) {
      showNotification(i18n('noResultsFound'), 'info');
    }
    return;
  }

  if (!isFromPanel) {
    showNotification(i18n('preparing'), 'sparkles');
  }

  try {
    const response = await fetch('https://localizeai-285680531861.us-central1.run.app/api/quality-check', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ 
        sourceTexts,
        sourceLang: currentSourceLang || 'en'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      if (!isFromPanel) {
        showNotification(i18n('noResultsFound'), 'x-circle');
      }
      return;
    }
    
    const data = await response.json();
    const issuesCount = (data.issues || []).length;
    
    // Show appropriate notification based on results
    if (!isFromPanel) {
      if (issuesCount === 0) {
        showNotification(i18n('complete'), 'check-circle');
      } else {
        showNotification(i18n('foundTextsToTranslate', issuesCount), 'alert-triangle');
      }
    }
    
    // Always show results dialog
    if (shimmer) shimmer.stop();
    if (isFromPanel) await stopPanelShimmer('quality-check-btn');
    showQualityResults(data.issues || [], sourceTexts, nodeMap, data.qualityStatus);
  } catch (error) {
    console.error('Quality check error:', error);
    if (shimmer) shimmer.stop();
    if (isFromPanel) await stopPanelShimmer('quality-check-btn');
    if (!isFromPanel) {
      showNotification(i18n('noResultsFound'), 'x-circle');
    }
  }
}

function showQualityResults(issues, translations, nodeMap, qualityStatus = 'issues_found') {
  // LARGE DIALOG - Always show on page with full-screen overlay
  if (isInSidePanel) {
    console.warn('[Panel] Large dialogs should be shown on page, not in panel');
    return;
  }
  
  const dialog = document.createElement('div');
  dialog.className = 'localizeai-dialog';
  
  // Count severity levels
  const highIssues = issues.filter(i => i.severity === 'high').length;
  const mediumIssues = issues.filter(i => i.severity === 'medium').length;
  const lowIssues = issues.filter(i => i.severity === 'low').length;
  
  let issuesHtml = '';
  if (issues.length === 0) {
    issuesHtml = `
      <div style="text-align: center; padding: 80px 32px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 24px; position: relative; overflow: hidden;">
        <!-- Decorative circles -->
        <div style="position: absolute; top: -40px; right: -40px; width: 160px; height: 160px; background: rgba(34, 197, 94, 0.08); border-radius: 50%;"></div>
        <div style="position: absolute; bottom: -60px; left: -60px; width: 200px; height: 200px; background: rgba(34, 197, 94, 0.05); border-radius: 50%;"></div>
        
        <!-- Success icon -->
        <div style="position: relative; width: 96px; height: 96px; margin: 0 auto 24px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 12px 32px rgba(34, 197, 94, 0.25), 0 0 0 12px rgba(34, 197, 94, 0.1);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        
        <!-- Title -->
        <h3 style="position: relative; font-size: 28px; font-weight: 700; color: #166534; margin-bottom: 12px; letter-spacing: -0.5px;">${i18n('excellent')}</h3>
        
        <!-- Description -->
        <p style="position: relative; font-size: 16px; color: #15803d; line-height: 1.6; max-width: 420px; margin: 0 auto 32px;">
          ${i18n('checkedTextsNoIssues', translations.length)}
        </p>
        
        <!-- Checked items -->
        <div style="position: relative; background: white; border-radius: 16px; padding: 20px 24px; margin: 0 auto; display: inline-block; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          <div style="font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">${i18n('checkedLabel')}</div>
          <div style="display: flex; gap: 24px; font-size: 13px; color: #059669; font-weight: 500;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 20px; height: 20px; background: #d1fae5; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              ${i18n('spelling')}
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 20px; height: 20px; background: #d1fae5; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              ${i18n('grammar')}
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 20px; height: 20px; background: #d1fae5; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              ${i18n('formatting')}
            </div>
          </div>
        </div>
        
        <!-- Footer note -->
        <p style="position: relative; font-size: 13px; color: #6b7280; margin-top: 24px; font-weight: 500;">
          ${i18n('noIssuesInOriginalText')}
        </p>
      </div>
    `;
  } else {
    issuesHtml = issues.map((issue, issueIdx) => {
      const sourceText = translations[issue.index];
      
      // Severity styling - minimal and clean
      const severityStyles = {
        high: { bg: '#fef2f2', border: '#fecaca', badge: '#dc2626', text: '#991b1b' },
        medium: { bg: '#fffbeb', border: '#fde68a', badge: '#f59e0b', text: '#92400e' },
        low: { bg: '#eff6ff', border: '#bfdbfe', badge: '#3b82f6', text: '#1e40af' }
      };
      
      const style = severityStyles[issue.severity] || severityStyles.low;
      
      // Extract better text
      let betterText = issue.betterText || issue.betterTranslation;
      if (!betterText) {
        const match = issue.suggestion.match(/["']([^"']+)["']|:\s*(.+?)(?:\.|$)/);
        if (match) {
          betterText = match[1] || match[2];
        }
      }
      
      return `
        <div class="quality-issue-card" data-issue-index="${issueIdx}" data-translation-index="${issue.index}" 
             style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; margin-bottom: 12px;">
          
          <!-- Header -->
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
            <span style="background: ${style.badge}; color: white; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px;">
              ${issue.severity.toUpperCase()}
            </span>
            <span style="font-size: 14px; font-weight: 600; color: #111827;">${issue.issue}</span>
          </div>
          
          <!-- Current text -->
          <div style="margin-bottom: 12px;">
            <div style="font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">${i18n('current')}</div>
            <div style="font-size: 14px; color: #dc2626; line-height: 1.5;">${sourceText.text}</div>
          </div>
          
          <!-- Suggested text -->
          ${betterText ? `
            <div style="margin-bottom: 12px;">
              <div style="font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">${i18n('suggested')}</div>
              <div style="font-size: 14px; color: #10b981; font-weight: 600; line-height: 1.5;">${betterText}</div>
            </div>
          ` : ''}
          
          <!-- Suggestion -->
          <div style="font-size: 13px; color: #6b7280; line-height: 1.5; margin-bottom: 14px; padding: 10px; background: #f9fafb; border-radius: 8px;">
            ${issue.suggestion}
          </div>
          
          <!-- Action button -->
          ${betterText ? `
            <button class="apply-suggestion-btn" 
                    data-translation-index="${issue.index}" 
                    data-better-translation="${betterText.replace(/"/g, '&quot;')}" 
                    style="width: 100%; padding: 12px; background: #10b981; color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              ${i18n('applyFix')}
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  }
  
  dialog.innerHTML = `
    <div class="dialog-content" style="max-width: 720px; max-height: 90vh; display: flex; flex-direction: column; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.15); background: white;">
      <!-- Header -->
      <div style="padding: 24px 28px 20px; background: white; border-bottom: 1px solid #f3f4f6;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          </div>
          <h3 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0;">${i18n('qualityCheckReport')}</h3>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin: 0 0 0 48px;">
          ${i18n('checkedTextsWithCount', translations.length)}
          ${issues.length > 0 ? ` • <span style="color: #dc2626; font-weight: 600;">${i18n('foundErrorsCount', issues.length)}</span>` : ` • <strong style="color: #10b981;">${i18n('noErrors')}</strong>`}
        </p>
      </div>
      
      <!-- Issues list -->
      <div class="issues-scroll" style="flex: 1; overflow-y: auto; padding: 20px 28px; background: #fafbfc; scrollbar-width: none; -ms-overflow-style: none;">
        ${issuesHtml}
      </div>
      
      <!-- Footer actions -->
      <div style="padding: 16px 28px; display: flex; gap: 10px; background: white; border-top: 1px solid #e5e7eb; justify-content: center;">
        ${issues.length > 0 && issues.some(i => i.betterTranslation || i.suggestion.includes('"')) ? `
          <button id="apply-all-suggestions-btn" style="flex: 1; max-width: 200px; padding: 14px 24px; background: #10b981; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            ${i18n('applyAll')}
          </button>
        ` : ''}
        <button id="localizeai-close-quality" style="flex: ${issues.length > 0 ? '1' : 'none'}; max-width: 200px; padding: 14px 24px; background: #f3f4f6; color: #374151; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          ${i18n('close')}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  // Add hover effects and hide scrollbar
  const style = document.createElement('style');
  style.textContent = `
    .issues-scroll::-webkit-scrollbar {
      display: none;
    }
    
    .apply-suggestion-btn:hover:not(:disabled) {
      background: #059669 !important;
      opacity: 0.9;
    }
    
    .apply-suggestion-btn:active:not(:disabled) {
      opacity: 1;
    }
    
    #apply-all-suggestions-btn:hover:not(:disabled) {
      background: #059669 !important;
      opacity: 0.9;
    }
    
    #apply-all-suggestions-btn:active:not(:disabled) {
      opacity: 1;
    }
    
    #localizeai-close-quality:hover {
      background: #e5e7eb !important;
    }
    
    #localizeai-close-quality:active {
      background: #d1d5db !important;
    }
    
    .quality-issue-card {
      transition: all 0.2s ease;
    }
    
    .quality-issue-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
  `;
  document.head.appendChild(style);

  // Apply individual suggestion
  dialog.querySelectorAll('.apply-suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const translationIndex = parseInt(btn.dataset.translationIndex);
      const betterTranslation = btn.dataset.betterTranslation;
      const node = nodeMap.get(translationIndex);
      
      if (node && betterTranslation) {
        node.textContent = betterTranslation;
        translations.set(node, betterTranslation);
        translationMemory.set(originalTexts.get(node), betterTranslation);
        
        // Update UI with success state
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          ${i18n('applied')}
        `;
        btn.style.background = '#6ee7b7';
        btn.style.cursor = 'default';
        btn.style.opacity = '0.8';
        btn.disabled = true;
        
        showNotification(i18n('improvementApplied'), 'check-circle');
      }
    });
  });

  // Apply all suggestions
  const applyAllBtn = document.getElementById('apply-all-suggestions-btn');
  if (applyAllBtn) {
    applyAllBtn.addEventListener('click', () => {
      let appliedCount = 0;
      
      issues.forEach(issue => {
        let betterTranslation = issue.betterTranslation;
        if (!betterTranslation) {
          const match = issue.suggestion.match(/["']([^"']+)["']|:\s*(.+?)(?:\.|$)/);
          if (match) {
            betterTranslation = match[1] || match[2];
          }
        }
        
        if (betterTranslation) {
          const node = nodeMap.get(issue.index);
          if (node) {
            node.textContent = betterTranslation;
            translations.set(node, betterTranslation);
            translationMemory.set(originalTexts.get(node), betterTranslation);
            appliedCount++;
          }
        }
      });
      
      // Update UI
      applyAllBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        ${i18n('appliedCount', appliedCount)}
      `;
      applyAllBtn.style.background = '#6ee7b7';
      applyAllBtn.style.cursor = 'default';
      applyAllBtn.style.opacity = '0.8';
      applyAllBtn.disabled = true;
      
      // Update individual buttons
      dialog.querySelectorAll('.apply-suggestion-btn').forEach(btn => {
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          ${i18n('applied')}
        `;
        btn.style.background = '#6ee7b7';
        btn.style.cursor = 'default';
        btn.style.opacity = '0.8';
        btn.disabled = true;
      });
      
      showNotification(i18n('appliedImprovements', appliedCount), 'check-circle');
    });
  }

  // Close dialog
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });

  document.getElementById('localizeai-close-quality').addEventListener('click', () => {
    dialog.remove();
  });

  showNotification(i18n('qualityCheckComplete'), issues.length > 0 ? 'sparkles' : 'check-circle');
}

// Smart Batch Translate with Context
async function smartBatchTranslate(skipShimmer = false) {
  // Check premium status FIRST before any action
  const { apiKey, user } = await chrome.storage.sync.get(['apiKey', 'user']);
  
  // Check if user is signed in first
  if (!user) {
    showNotification(i18n('pleaseSignInFirst'), 'alert-triangle', 3000);
    // Scroll to sign in button in panel
    setTimeout(() => {
      const signInBtn = document.getElementById('signin-btn');
      if (signInBtn) {
        signInBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 500);
    return;
  }
  
  // Check if user has premium
  if (!apiKey || !user?.isPremium) {
    showNotification(i18n('upgradeToPremium'), 'crown', 3000);
    setTimeout(() => showUpgradeDialog(), 500);
    return;
  }
  
  // If in panel, start shimmer and send action to page
  if (isInSidePanel) {
    console.log('[Smart Translate] Running in panel mode');
    
    // Start shimmer in panel
    const shimmer = createButtonShimmer('smart-translate-btn');
    if (shimmer) {
      console.log('[Smart Translate] Shimmer created in panel, starting animation...');
      shimmer.start();
      activeShimmers['smart-translate-btn'] = shimmer;
    }
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'smartBatchTranslate', fromPanel: true });
      // Shimmer will be stopped when page sends completion message
      return;
    } catch (error) {
      console.error('Failed to trigger smart translate on page:', error);
      if (shimmer) shimmer.stop();
      activeShimmers['smart-translate-btn'] = null;
      showNotification(i18n('translationStartError'), 'alert-triangle');
      return;
    }
  }
  
  // Running on page
  console.log('[Smart Translate] Running on page, skipShimmer:', skipShimmer);
  
  // Only create shimmer if not skipped (i.e., not called from panel message)
  let shimmer = null;
  if (!skipShimmer) {
    shimmer = createButtonShimmer('smart-translate-btn');
    if (shimmer) {
      console.log('[Smart Translate] Shimmer created on page, starting animation...');
      shimmer.start();
    }
  }

  // Save the current state of fromPanel flag
  const isFromPanel = currentActionFromPanel;
  
  // Always reload language settings from storage to ensure we have latest
  const savedSettings = await chrome.storage.sync.get(['sourceLanguage', 'targetLanguage']);
  if (savedSettings.sourceLanguage) currentSourceLang = savedSettings.sourceLanguage;
  if (savedSettings.targetLanguage) currentTargetLang = savedSettings.targetLanguage;
  
  console.log('[SmartBatchTranslate] Language settings from storage:', savedSettings);
  console.log('[SmartBatchTranslate] Current language settings:', {
    source: currentSourceLang,
    target: currentTargetLang
  });

  // Show info about what this feature does
  const infoEl = document.getElementById('smart-translate-info');
  if (infoEl) {
    infoEl.style.display = 'block';
    setTimeout(() => {
      infoEl.style.display = 'none';
    }, 5000);
  }

  if (!isFromPanel) {
    showNotification(i18n('preparing'), 'sparkles');
  }

  try {
    // Use cached text nodes if available
    if (!textNodesCache) {
      await preScanPageContent();
    }
    
    // Collect all translatable texts with context
    const textsWithContext = [];
    const nodesToTranslate = [];
    
    textNodes.forEach(node => {
      const text = node.textContent.trim();
      if (text.length > 0 && text.length < 500) {
        const parent = node.parentElement;
        if (parent && !parent.closest('script, style, noscript, iframe, #localizeai-panel')) {
          textsWithContext.push({
            text: text,
            element: parent.tagName.toLowerCase(),
            role: parent.getAttribute('role'),
            ariaLabel: parent.getAttribute('aria-label'),
            className: parent.className,
            id: parent.id
          });
          nodesToTranslate.push(node);
        }
      }
    });

    if (textsWithContext.length === 0) {
      if (shimmer) shimmer.stop();
      if (isFromPanel) await stopPanelShimmer('smart-translate-btn');
      if (!isFromPanel) {
        showNotification(i18n('noResultsFound'), 'alert-triangle');
      }
      return;
    }

    const totalTexts = textsWithContext.length;
    
    // Update info text with actual count
    const infoTextEl = document.getElementById('smart-translate-info-text');
    if (infoTextEl) {
      infoTextEl.textContent = i18n('foundTextsToTranslate', totalTexts);
    }
    
    // Update status
    updateStatus(`${i18n('foundTextsToTranslate', totalTexts)}`, 'loading');
    
    if (!isFromPanel) {
      showNotification(i18n('startingTranslation', totalTexts), 'sparkles');
    }

    // Translate in batches to handle large pages
    const BATCH_SIZE = 50;
    let translatedCount = 0;
    
    for (let i = 0; i < totalTexts; i += BATCH_SIZE) {
      const batch = textsWithContext.slice(i, i + BATCH_SIZE);
      const batchNodes = nodesToTranslate.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(totalTexts / BATCH_SIZE);
      
      // Update status
      const progressPercent = Math.round((i / totalTexts) * 100);
      updateStatus(`${i18n('translating')} ${i}/${totalTexts} (${progressPercent}%)`, 'loading');
      
      if (!isFromPanel) {
        showNotification(i18n('preparing'), 'sparkles');
      }

      // Prepare request body
      const requestBody = { 
        texts: batch,
        sourceLang: currentSourceLang || 'auto',
        targetLang: currentTargetLang || 'vi',
        glossary: Object.fromEntries(glossary)
      };
      
      console.log('[SmartBatchTranslate] Request body for batch', batchNum, ':', {
        textsCount: requestBody.texts.length,
        sourceLang: requestBody.sourceLang,
        targetLang: requestBody.targetLang,
        firstText: requestBody.texts[0],
        glossarySize: Object.keys(requestBody.glossary).length
      });
      console.log('[SmartBatchTranslate] Full request body:', JSON.stringify(requestBody, null, 2).substring(0, 500));
      
      // Send to backend for smart translation
      const response = await fetch('https://localizeai-285680531861.us-central1.run.app/api/smart-translate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const error = await response.json();
        if (!isFromPanel) {
          showNotification(i18n('noResultsFound'), 'x-circle');
        }
        continue;
      }
      
      const data = await response.json();
      
      console.log('[SmartBatchTranslate] Batch', batchNum, 'response:', data);
      console.log('[SmartBatchTranslate] Translations count:', data.translations?.length);
      console.log('[SmartBatchTranslate] Sample translations:', data.translations?.slice(0, 3));
      console.log('[SmartBatchTranslate] First translation detail:', JSON.stringify(data.translations?.[0], null, 2));
      console.log('[SmartBatchTranslate] Target language:', currentTargetLang);
      
      // Apply translations for this batch
      applySmartTranslationsBatch(data.translations, batchNodes);
      translatedCount += data.translations.length;
      
      // Update progress
      const currentProgressPercent = Math.round((translatedCount / totalTexts) * 100);
      updateStatus(`${i18n('translating')} ${translatedCount}/${totalTexts} (${currentProgressPercent}%)`, 'loading');
      
      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < totalTexts) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    isTranslated = true;
    if (shimmer) shimmer.stop();
    if (isFromPanel) await stopPanelShimmer('smart-translate-btn');
    
    // Update toggle buttons
    const originalBtn = document.getElementById('show-original');
    const translatedBtn = document.getElementById('show-translated');
    if (originalBtn && translatedBtn) {
      originalBtn.classList.remove('active');
      translatedBtn.classList.add('active');
    }
    
    // Update status
    updateStatus(`${i18n('complete')} - ${i18n('translated')} ${translatedCount} ${i18n('texts')}`, 'success');
    
    if (!isFromPanel) {
      showNotification(i18n('completedLanguages', translatedCount, totalTexts), 'check-circle');
    }
    
    // Show clear cache button
    const clearBtn = document.getElementById('clear-cache-btn');
    if (clearBtn) {
      clearBtn.style.display = 'flex';
    }
    
    // Update UI
    updateTranslationUI();
  } catch (error) {
    console.error('Smart translate error:', error);
    if (shimmer) shimmer.stop();
    if (isFromPanel) await stopPanelShimmer('smart-translate-btn');
    updateStatus(i18n('noResultsFound'), 'error');
    if (!isFromPanel) {
      showNotification(i18n('noResultsFound'), 'x-circle');
    }
  }
}

function applySmartTranslationsBatch(smartTranslations, textNodes) {
  // Apply translations to the specific batch of nodes
  console.log('[ApplyTranslations] Applying', smartTranslations?.length, 'translations to', textNodes.length, 'nodes');
  
  if (!smartTranslations || !Array.isArray(smartTranslations)) {
    console.error('[ApplyTranslations] Invalid translations:', smartTranslations);
    return;
  }
  
  let appliedCount = 0;
  smartTranslations.forEach((translation, index) => {
    const node = textNodes[index];
    if (!node) {
      console.warn('[ApplyTranslations] Node not found at index', index);
      return;
    }
    
    const original = node.textContent.trim();
    const translated = translation.translated || translation; // Handle both object and string
    
    if (index < 3) {
      console.log('[ApplyTranslations] Sample', index, ':', {
        original: original.substring(0, 50),
        translated: typeof translated === 'string' ? translated.substring(0, 50) : translated,
        type: typeof translated,
        translationObject: translation,
        isEqual: translated === original
      });
    }
    
    if (translated && translated !== original) {
      originalTexts.set(node, original);
      translations.set(node, translated);
      translationMemory.set(original, translated);
      node.textContent = translated;
      appliedCount++;
      
      if (index < 3) {
        console.log('[ApplyTranslations] Applied translation', index, '- node.textContent is now:', node.textContent.substring(0, 50));
      }
    }
  });
  
  console.log('[ApplyTranslations] Applied', appliedCount, 'out of', smartTranslations.length, 'translations');
}

// Helper function to adjust email font size based on length
function adjustEmailFontSize(emailElement, email) {
  if (!emailElement || !email) return;
  
  const length = email.length;
  let fontSize;
  
  if (length <= 15) {
    fontSize = '14px'; // Short email - larger font
  } else if (length <= 25) {
    fontSize = '13px'; // Medium email - default
  } else if (length <= 35) {
    fontSize = '12px'; // Long email - smaller
  } else {
    fontSize = '11px'; // Very long email - smallest
  }
  
  emailElement.style.fontSize = fontSize;
}

// Helper function to load external image (Google profile images support CORS)
async function loadExternalImage(imageUrl, imgElement, fallbackElement) {
  if (!imageUrl || !imgElement) {
    console.warn('[Avatar] Missing imageUrl or imgElement');
    if (fallbackElement) fallbackElement.style.display = 'flex';
    if (imgElement) imgElement.style.display = 'none';
    return false;
  }
  
  try {
    // Google profile images can be loaded directly
    // Just set the src and handle load/error events
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('[Avatar] Load timeout after 5 seconds');
        imgElement.style.display = 'none';
        if (fallbackElement) fallbackElement.style.display = 'flex';
        resolve(false);
      }, 5000);
      
      imgElement.onload = () => {
        console.log('[Avatar] Image loaded successfully!');
        clearTimeout(timeout);
        imgElement.style.display = 'block';
        if (fallbackElement) fallbackElement.style.display = 'none';
        resolve(true);
      };
      
      imgElement.onerror = (error) => {
        console.error('[Avatar] Image load failed:', error);
        clearTimeout(timeout);
        imgElement.style.display = 'none';
        if (fallbackElement) fallbackElement.style.display = 'flex';
        resolve(false);
      };
      
      // Set the src to trigger loading
      imgElement.src = imageUrl;
    });
  } catch (error) {
    console.error('[Avatar] Error loading image:', error);
    imgElement.style.display = 'none';
    if (fallbackElement) fallbackElement.style.display = 'flex';
    return false;
  }
}

// Premium Management
async function loadPremiumStatus() {
  try {
    // Get user data from storage first
    let { user, apiKey } = await chrome.storage.sync.get(['user', 'apiKey']);
    
    // If user is signed in, sync subscription status from backend
    if (user && apiKey) {
      try {
        const syncResult = await chrome.runtime.sendMessage({ action: 'checkSubscription' });
        
        // Re-fetch user data after sync
        const updated = await chrome.storage.sync.get(['user', 'apiKey']);
        user = updated.user;
        apiKey = updated.apiKey;
      } catch (syncError) {
        console.log('[Premium] Error syncing subscription:', syncError);
      }
    }
    
    // Refresh user info from Google to get latest picture
    console.log('[Premium] Refreshing user info from Google...');
    try {
      const refreshResult = await chrome.runtime.sendMessage({ action: 'refreshUserInfo' });
      if (refreshResult && !refreshResult.error) {
        console.log('[Premium] User info refreshed successfully');
        // Re-fetch after refresh
        const updated = await chrome.storage.sync.get(['user']);
        user = updated.user;
      }
    } catch (refreshError) {
      // Refresh error - continue with cached data
    }
    
    const notSignedIn = document.getElementById('premium-not-signed-in');
    const freeView = document.getElementById('premium-free-view');
    const activeView = document.getElementById('premium-active-view');
    
    if (!notSignedIn || !freeView || !activeView) {
      console.error('Premium status elements not found');
      return;
    }
    
    // State 1: Not signed in
    if (!user) {
      console.log('State: Not signed in');
      notSignedIn.style.display = 'block';
      freeView.style.display = 'none';
      activeView.style.display = 'none';
      return;
    }

    // State 2: Signed in but free tier
    if (!apiKey || !user.isPremium) {
      console.log('State: Signed in - Free tier');
      notSignedIn.style.display = 'none';
      freeView.style.display = 'block';
      activeView.style.display = 'none';
      
      // Update user info in free view
      const freeUserName = document.getElementById('free-user-name');
      const freeUserEmail = document.getElementById('free-user-email');
      const freeUserAvatar = document.getElementById('free-user-avatar');
      const freeUserFallback = document.getElementById('free-user-avatar-fallback');
      
      if (freeUserName) {
        freeUserName.textContent = user.name || user.email.split('@')[0];
      }
      
      if (freeUserEmail) {
        freeUserEmail.textContent = user.email || '';
        adjustEmailFontSize(freeUserEmail, user.email);
      }
      
      if (freeUserAvatar && user.picture) {
        console.log('[Avatar] Loading free avatar:', user.picture);
        loadExternalImage(user.picture, freeUserAvatar, freeUserFallback);
      } else {
        if (freeUserAvatar) freeUserAvatar.style.display = 'none';
        if (freeUserFallback) freeUserFallback.style.display = 'flex';
      }
      
      return;
    }

    // State 3: Premium active (already synced from backend)
    console.log('State: Premium active');
    notSignedIn.style.display = 'none';
    freeView.style.display = 'none';
    activeView.style.display = 'block';
    
    // Update user info
    const userName = document.getElementById('premium-user-name');
    const userEmail = document.getElementById('premium-email');
    const userAvatar = document.getElementById('premium-user-avatar');
    const userFallback = document.getElementById('premium-user-avatar-fallback');
    
    if (userName) {
      userName.textContent = user.name || user.email.split('@')[0];
    }
    
    if (userEmail) {
      userEmail.textContent = user.email || '';
      adjustEmailFontSize(userEmail, user.email);
    }
    
    if (userAvatar && user.picture) {
      loadExternalImage(user.picture, userAvatar, userFallback);
    } else {
      if (userAvatar) userAvatar.style.display = 'none';
      if (userFallback) userFallback.style.display = 'flex';
    }
  } catch (error) {
    console.error('Load premium status error:', error);
    
    // Try to show user info even on error
    const { user } = await chrome.storage.sync.get(['user']);
    const notSignedIn = document.getElementById('premium-not-signed-in');
    const freeView = document.getElementById('premium-free-view');
    const activeView = document.getElementById('premium-active-view');
    
    if (user) {
      // Show free view with user info
      console.log('Error but user exists - showing free view');
      if (notSignedIn) notSignedIn.style.display = 'none';
      if (freeView) freeView.style.display = 'block';
      if (activeView) activeView.style.display = 'none';
      
      const freeUserName = document.getElementById('free-user-name');
      const freeUserEmail = document.getElementById('free-user-email');
      const freeUserAvatar = document.getElementById('free-user-avatar');
      const freeUserFallback = document.getElementById('free-user-avatar-fallback');
      
      if (freeUserName) {
        freeUserName.textContent = user.name || user.email.split('@')[0];
      }
      
      if (freeUserEmail) {
        freeUserEmail.textContent = user.email || '';
        adjustEmailFontSize(freeUserEmail, user.email);
      }
      if (freeUserAvatar && user.picture) {
        console.log('Loading free avatar (catch error case):', user.picture);
        // Use helper function to load external image through background script
        loadExternalImage(user.picture, freeUserAvatar, freeUserFallback);
      } else if (freeUserFallback) {
        if (freeUserAvatar) freeUserAvatar.style.display = 'none';
        freeUserFallback.style.display = 'flex';
      }
    } else {
      // No user - show sign in
      if (notSignedIn) notSignedIn.style.display = 'block';
      if (freeView) freeView.style.display = 'none';
      if (activeView) activeView.style.display = 'none';
    }
  }
}

async function showUpgradeDialog() {
  // LARGE DIALOG - Show on page (full-screen) for better viewing
  if (isInSidePanel) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'showUpgradeDialog' });
      return;
    } catch (error) {
      console.error('Failed to show upgrade dialog on page:', error);
      // Fallback: show in panel
    }
  }
  
  // Check if user is signed in
  const { user, apiKey } = await chrome.storage.sync.get(['user', 'apiKey']);
  
  if (!user) {
    showNotification(i18n('pleaseSignInFirst'), 'alert-triangle');
    return;
  }
  
  // Get usage stats
  let usageInfo = null;
  if (apiKey) {
    try {
      const response = await fetch('https://localizeai-285680531861.us-central1.run.app/api/usage/stats', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (response.ok) {
        usageInfo = await response.json();
      }
    } catch (error) {
      console.error('Failed to get usage stats:', error);
    }
  }
  
  const dialog = document.createElement('div');
  dialog.className = 'localizeai-dialog';
  dialog.innerHTML = `
    <div class="dialog-content premium-modal">
      <div class="premium-modal-header">
        <div class="premium-icon-wrapper">
          <img src="${chrome.runtime.getURL('icons/lucide/crown.svg')}" width="28" height="28" class="premium-icon">
        </div>
        <h3 class="premium-modal-title">${i18n('upgradeToPremiumHeader')}</h3>
        <p class="premium-modal-subtitle">${i18n('unlockUnlimitedAccess')}</p>
      </div>
      
      <div class="premium-pricing-card">
        <div class="premium-price-tag">
          <span class="premium-currency">$</span>
          <span class="premium-amount">9.99</span>
        </div>
        <div class="premium-period">${i18n('perMonth')}</div>
        
        <div class="premium-features-list">
          <div class="premium-feature-item">
            <img src="${chrome.runtime.getURL('icons/lucide/infinity.svg')}" width="18" height="18" class="feature-icon">
            <span>${i18n('unlimitedTranslations')}</span>
          </div>
          <div class="premium-feature-item">
            <img src="${chrome.runtime.getURL('icons/lucide/sparkles.svg')}" width="18" height="18" class="feature-icon">
            <span>${i18n('aiSmartSuggestions')}</span>
          </div>
          <div class="premium-feature-item">
            <img src="${chrome.runtime.getURL('icons/lucide/zap.svg')}" width="18" height="18" class="feature-icon">
            <span>${i18n('fastBatchTranslation')}</span>
          </div>
          <div class="premium-feature-item">
            <img src="${chrome.runtime.getURL('icons/lucide/check-circle.svg')}" width="18" height="18" class="feature-icon">
            <span>${i18n('autoQualityCheck')}</span>
          </div>
          <div class="premium-feature-item">
            <img src="${chrome.runtime.getURL('icons/lucide/headphones.svg')}" width="18" height="18" class="feature-icon">
            <span>${i18n('prioritySupport')}</span>
          </div>
        </div>
      </div>

      <button id="localizeai-goto-checkout" class="premium-subscribe-btn">
        <img src="${chrome.runtime.getURL('icons/lucide/credit-card.svg')}" width="18" height="18">
        <span>${i18n('subscribeNow')}</span>
      </button>
      
      <div class="premium-secondary-actions">
        <button id="localizeai-contact-support-upgrade" class="premium-support-btn">
          <img src="${chrome.runtime.getURL('icons/lucide/mail.svg')}" width="16" height="16">
          <span>Contact Support</span>
        </button>
        <button id="localizeai-close-upgrade" class="premium-later-btn">
          ${i18n('maybeLater')}
        </button>
      </div>
      
      <p class="premium-cancel-note">
        <img src="${chrome.runtime.getURL('icons/lucide/shield-check.svg')}" width="12" height="12">
        ${i18n('cancelAnytime')}
      </p>
    </div>
  `;
  document.body.appendChild(dialog);

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.remove();
  });

  document.getElementById('localizeai-goto-checkout').addEventListener('click', () => {
    window.open(`https://localizeai-285680531861.us-central1.run.app/checkout?email=${encodeURIComponent(user.email)}`, '_blank');
    dialog.remove();
  });

  document.getElementById('localizeai-contact-support-upgrade').addEventListener('click', () => {
    window.open('https://localizeai-285680531861.us-central1.run.app/support', '_blank');
    dialog.remove();
  });

  document.getElementById('localizeai-close-upgrade').addEventListener('click', () => {
    dialog.remove();
  });
}

// Sign in from sidebar
async function handleSignInSidebar() {
  try {
    showNotification(i18n('preparing'), 'loader');
    
    chrome.runtime.sendMessage({ action: 'signInWithGoogle' }, async (response) => {
      if (chrome.runtime.lastError) {
        console.error('Sign in error:', chrome.runtime.lastError.message || chrome.runtime.lastError);
        
        // Show error with retry option
        const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
        if (errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
          showNotification(i18n('authenticationFailed'), 'alert-triangle');
        } else {
          showNotification(i18n('signInFailed'), 'alert-triangle');
        }
        return;
      }
      
      if (response) {
        await loadPremiumStatus();
        showNotification(i18n('signedInSuccessfully'), 'check-circle');
      }
    });
  } catch (error) {
    console.error('Sign in error:', error);
    showNotification(i18n('signInFailed'), 'alert-triangle');
  }
}

// Sign out from sidebar
async function handleSignOutSidebar() {
  const confirmed = await showConfirmDialog(
    i18n('signOut'),
    i18n('signOut'),
    i18n('signOut'),
    i18n('cancel')
  );
  
  if (confirmed) {
    try {
      chrome.runtime.sendMessage({ action: 'signOut' }, async (response) => {
        if (chrome.runtime.lastError) {
          console.error('Sign out error:', chrome.runtime.lastError);
          return;
        }
        
        await loadPremiumStatus();
        showNotification(i18n('signedOutSuccessfully'), 'check-circle');
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }
}

// Clear auth cache and retry sign in (for troubleshooting 401 errors)
async function clearAuthCacheAndRetry() {
  try {
    showNotification(i18n('clearingCache'), 'loader');
    
    // Clear cached auth token
    chrome.runtime.sendMessage({ action: 'clearAuthCache' }, async (response) => {
      if (chrome.runtime.lastError) {
        console.error('Clear cache error:', chrome.runtime.lastError);
        showNotification(i18n('failedToClearCache'), 'alert-triangle');
        return;
      }
      
      // Wait a bit then retry sign in
      setTimeout(() => {
        handleSignInSidebar();
      }, 500);
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    showNotification(i18n('failedToClearCache'), 'alert-triangle');
  }
}

// Show Premium Info Dialog
async function showPremiumInfoDialog() {
  // LARGE DIALOG - Show on page (full-screen) for better viewing
  if (isInSidePanel) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'showPremiumInfoDialog' });
      return;
    } catch (error) {
      console.error('Failed to show premium info on page:', error);
      // Fallback: show in panel
    }
  }
  
  try {
    // Fetch fresh premium data from backend
    const { apiKey } = await chrome.storage.sync.get(['apiKey']);
    
    if (!apiKey) {
      showNotification(i18n('noResultsFound'), 'alert-triangle');
      return;
    }

    const BACKEND_URL = 'https://localizeai-285680531861.us-central1.run.app';
    const response = await fetch(`${BACKEND_URL}/api/subscription/status`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch subscription status');
    }

    const premiumData = await response.json();
    
    console.log('📊 Premium data received:', premiumData);
    console.log('📅 Subscription dates:', {
      start: premiumData.subscriptionStartDate,
      end: premiumData.subscriptionEndDate,
      cancelled: premiumData.subscriptionCancelledAt
    });
    
    // Calculate subscription info
    let expiryDate = 'Not specified';
    let startDate = 'Not specified';
    let daysRemaining = 0;
    let subscriptionPlan = 'Monthly Premium';
    let subscriptionStatus = premiumData.lemonSqueezy?.status || 'active';
    let isCancelled = !!premiumData.subscriptionCancelledAt;
    
    // Format start date
    if (premiumData.subscriptionStartDate) {
      try {
        const start = new Date(premiumData.subscriptionStartDate);
        if (!isNaN(start.getTime())) {
          startDate = start.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          console.log('✅ Start date formatted:', startDate);
        }
      } catch (e) {
        console.error('❌ Error formatting start date:', e);
      }
    }
    
    // Format end date
    if (premiumData.subscriptionEndDate) {
      try {
        const endDate = new Date(premiumData.subscriptionEndDate);
        if (!isNaN(endDate.getTime())) {
          expiryDate = endDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          
          const now = new Date();
          const diffTime = endDate - now;
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          console.log('✅ End date formatted:', expiryDate);
          console.log('📆 Days remaining:', daysRemaining);
        }
      } catch (e) {
        console.error('❌ Error formatting end date:', e);
      }
    } else {
      console.warn('⚠️ No subscriptionEndDate in response');
    }
    
    // Determine subscription plan
    if (premiumData.lemonSqueezy?.variantId) {
      // You can map variant IDs to plan names here
      subscriptionPlan = 'Monthly Premium';
    }
    
    const dialog = document.createElement('div');
    dialog.className = 'localizeai-dialog';
    dialog.innerHTML = `
      <div class="dialog-content" style="max-width: 420px; padding: 32px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 28px;">
          <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; box-shadow: 0 8px 24px rgba(251, 191, 36, 0.25);">
            <img src="${chrome.runtime.getURL('icons/lucide/crown.svg')}" width="32" height="32" style="filter: brightness(0) invert(1);">
          </div>
          <h3 style="margin: 0 0 6px 0; font-size: 24px; font-weight: 700; color: #1a1a1a;">Premium Account</h3>
          <p style="margin: 0; font-size: 13px; color: #9ca3af;">${premiumData.email}</p>
        </div>
        
        <!-- Status Badge -->
        <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; background: ${isCancelled ? '#fff3cd' : '#e8f5e9'}; border-radius: 20px; margin: 0 auto 20px; display: flex; justify-content: center;">
          <div style="width: 6px; height: 6px; background: ${isCancelled ? '#ff9800' : '#4caf50'}; border-radius: 50%; animation: pulse 2s infinite;"></div>
          <span style="font-size: 12px; font-weight: 600; color: ${isCancelled ? '#f57c00' : '#2e7d32'};">${isCancelled ? 'Cancelled (Access until expiry)' : 'Active Subscription'}</span>
        </div>
        
        <!-- Info Cards - Simple -->
        <div style="display: grid; gap: 10px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #f8f9fa; border-radius: 10px; border: 1px solid #e9ecef;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${chrome.runtime.getURL('icons/lucide/package.svg')}" width="18" height="18" style="opacity: 0.6;">
              <span style="font-size: 14px; color: #6b7280; font-weight: 500;">Plan</span>
            </div>
            <span style="font-size: 14px; font-weight: 700; color: #1a1a1a;">${subscriptionPlan}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #f8f9fa; border-radius: 10px; border: 1px solid #e9ecef;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${chrome.runtime.getURL('icons/lucide/calendar.svg')}" width="18" height="18" style="opacity: 0.6;">
              <span style="font-size: 14px; color: #6b7280; font-weight: 500;">Expiry Date</span>
            </div>
            <span style="font-size: 14px; font-weight: 700; color: #1a1a1a;">${expiryDate}</span>
          </div>
        </div>
        
        <!-- Actions -->
        <div style="display: flex; gap: 10px;">
          <button id="contact-support-btn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);">
            <img src="${chrome.runtime.getURL('icons/lucide/mail.svg')}" width="16" height="16" style="filter: brightness(0) invert(1);">
            Contact Support
          </button>
          <button id="close-premium-info" style="padding: 12px 20px; background: #f3f4f6; color: #6b7280; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s;">
            Close
          </button>
        </div>
      </div>
      
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      </style>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.remove();
    });
    
    document.getElementById('close-premium-info').addEventListener('click', () => {
      dialog.remove();
    });
    
    document.getElementById('contact-support-btn').addEventListener('click', () => {
      dialog.remove();
      // Open support page in new tab with full URL
      const supportUrl = 'https://localizeai-285680531861.us-central1.run.app/support';
      window.open(supportUrl, '_blank');
    });
    
    // Add hover effects
    const contactBtn = document.getElementById('contact-support-btn');
    const closeBtn = document.getElementById('close-premium-info');
    
    contactBtn.addEventListener('mouseenter', () => {
      contactBtn.style.transform = 'translateY(-2px)';
      contactBtn.style.boxShadow = '0 8px 24px rgba(251, 191, 36, 0.4)';
    });
    contactBtn.addEventListener('mouseleave', () => {
      contactBtn.style.transform = 'translateY(0)';
      contactBtn.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.3)';
    });
    
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#e5e7eb';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = '#f3f4f6';
    });
  } catch (error) {
    console.error('Show premium info error:', error);
    showNotification(i18n('noResultsFound'), 'alert-triangle');
  }
}

// Handle Drive Sync
async function handleSyncDrive() {
  try {
    const { user } = await chrome.storage.sync.get(['user']);
    
    if (!user) {
      showNotification(i18n('signInWithGoogle'), 'alert-triangle');
      return;
    }
    
    showNotification(i18n('preparing'), 'loader');
    
    // Get all bug reports - if in panel, get from page; otherwise get locally
    let reports = [];
    if (isInSidePanel) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getBugReports' });
        reports = response.reports || [];
      } catch (error) {
        console.error('Failed to get reports from page:', error);
        showNotification(i18n('reportsLoadError'), 'alert-triangle');
        return;
      }
    } else {
      reports = await bugReportDB.getAllReports();
    }
    
    if (reports.length === 0) {
      showNotification(i18n('noResultsFound'), 'info');
      return;
    }
    
    // Sync to Drive
    if (window.driveSyncService) {
      await window.driveSyncService.syncToCloud(reports);
      showNotification(i18n('complete'), 'check-circle');
    } else {
      showNotification(i18n('driveSyncNotAvailable'), 'alert-triangle');
    }
  } catch (error) {
    console.error('Sync error:', error);
    showNotification(i18n('syncFailed', error.message), 'alert-triangle');
  }
}

// Legacy function - kept for backward compatibility
function showEnterKeyDialog() {
  // Redirect to sign in instead
  showNotification(i18n('signInWithGoogle'), 'info');
}

// Legacy function - redirect to new sign out
async function logoutPremium() {
  await handleSignOutSidebar();
}

// Bug Report System with IndexedDB
let bugReportMode = false;

function toggleBugReport() {
  if (bugReportMode) {
    // Disable mode
    disableBugReportCapture();
    
    // Only update button if not in side panel (button is on page)
    if (!isInSidePanel) {
      const btn = document.getElementById('bug-report-btn');
      if (btn) {
        btn.innerHTML = `
          <img src="${chrome.runtime.getURL('icons/lucide/flag.svg')}" class="btn-icon-sm" width="16" height="16">
          <span>${i18n('startReporting')}</span>
        `;
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
      }
    }
    
    showNotification(i18n('bugReportModeDisabled') || 'Bug report mode disabled', 'x-circle');
  } else {
    // Enable mode
    bugReportMode = true;
    
    // Only update button if not in side panel
    if (!isInSidePanel) {
      const btn = document.getElementById('bug-report-btn');
      if (btn) {
        btn.innerHTML = `
          <img src="${chrome.runtime.getURL('icons/lucide/x.svg')}" class="btn-icon-sm" width="16" height="16">
          <span>${i18n('close')}</span>
        `;
        btn.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
        btn.style.borderColor = '#3b82f6';
        btn.style.color = '#1e40af';
      }
    }
    
    // Visual indicators
    document.body.style.cursor = 'crosshair';
    
    // Event listeners - use named functions for proper removal
    document.addEventListener('mouseover', highlightElementForReport, false);
    document.addEventListener('mouseout', unhighlightElementForReport, false);
    document.addEventListener('click', captureElement, true);
    document.addEventListener('keydown', cancelBugReportCapture, false);
    
    showNotification(i18n('bugReportModeEnabled') || 'Click on any element to report an issue. Press ESC to cancel.', 'flag', 5000);
  }
}

function disableBugReportCapture() {
  bugReportMode = false;
  document.body.style.cursor = '';
  
  // Remove event listeners with exact same parameters as addEventListener
  document.removeEventListener('mouseover', highlightElementForReport, false);
  document.removeEventListener('mouseout', unhighlightElementForReport, false);
  document.removeEventListener('click', captureElement, true);
  document.removeEventListener('keydown', cancelBugReportCapture, false);
  
  // Remove any lingering highlights
  document.querySelectorAll('[data-localizeai-highlight]').forEach(el => {
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.removeAttribute('data-localizeai-highlight');
  });
}

function hasTextContent(element) {
  // Check if element has direct text content (not just from children)
  const directText = Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent.trim())
    .join('');
  
  if (!directText || directText.length === 0) return false;
  
  // Skip script, style, etc.
  const tagName = element.tagName.toLowerCase();
  if (['script', 'style', 'noscript', 'iframe', 'svg', 'path', 'img', 'video', 'audio', 'canvas'].includes(tagName)) {
    return false;
  }
  
  return true;
}

function highlightElementForReport(e) {
  if (!bugReportMode) return;
  const element = e.target;
  
  // Ignore our UI
  if (element.closest('#localizeai-panel, .localizeai-dialog')) return;
  
  // Only highlight elements with direct text content
  if (!hasTextContent(element)) {
    // Show not-allowed cursor for non-text elements
    document.body.style.cursor = 'not-allowed';
    return;
  }
  
  // Reset cursor to crosshair for valid text elements
  document.body.style.cursor = 'crosshair';
  element.style.outline = '2px solid #93c5fd';
  element.style.outlineOffset = '2px';
  element.setAttribute('data-localizeai-highlight', 'true');
}

function unhighlightElementForReport(e) {
  if (!bugReportMode) return;
  const element = e.target;
  
  if (element.hasAttribute('data-localizeai-highlight')) {
    element.style.outline = '';
    element.style.outlineOffset = '';
    element.removeAttribute('data-localizeai-highlight');
  }
  
  // Reset cursor to crosshair when leaving element
  document.body.style.cursor = 'crosshair';
}

function cancelBugReportCapture(e) {
  if (e.key === 'Escape' && bugReportMode) {
    disableBugReportCapture();
  }
}

function captureElement(e) {
  if (!bugReportMode) return;
  
  const element = e.target;
  
  // Ignore clicks on our UI
  if (element.closest('#localizeai-panel, .localizeai-dialog')) {
    return;
  }
  
  // Only allow text elements
  if (!hasTextContent(element)) {
    e.preventDefault();
    e.stopPropagation();
    showNotification(i18n('noResultsFound'), 'alert-triangle');
    return;
  }

  // Prevent default action and stop propagation for valid text elements
  e.preventDefault();
  e.stopPropagation();

  // Show dialog directly (no screenshot needed for text issues)
  showBugReportDialog(element);
  disableBugReportCapture();
}

function showBugReportDialog(element) {
  // LARGE DIALOG - Always show on page with full-screen overlay
  if (isInSidePanel) {
    console.warn('[Panel] Large dialogs should be shown on page, not in panel');
    return;
  }
  
  // Find text node and get translation context
  const textNodes = Array.from(element.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
  const textNode = textNodes.find(n => n.textContent.trim().length > 0);
  
  const originalText = textNode ? (originalTexts.get(textNode) || element.textContent.trim()) : element.textContent.trim();
  const translatedText = textNode ? (translations.get(textNode) || null) : null;
  
  const dialog = document.createElement('div');
  dialog.className = 'localizeai-dialog';
  dialog.innerHTML = `
    <div class="dialog-content bug-report-dialog-modern" style="max-width: 600px;">
      <h4 style="display: flex; align-items: center; gap: 10px; margin: 0 0 8px 0; font-size: 20px; color: #1a1a1a;">
        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <img src="${chrome.runtime.getURL('icons/lucide/bug.svg')}" width="20" height="20" style="filter: brightness(0) invert(1);">
        </div>
        <span>Report Localization Issue</span>
      </h4>
      <p style="font-size: 13px; color: #6b7280; margin: 0 0 20px 0; padding-left: 50px; display: flex; align-items: center; gap: 6px;">
        <img src="${chrome.runtime.getURL('icons/lucide/lightbulb.svg')}" width="14" height="14" style="opacity: 0.6;">
        Describe the text translation or localization problem
      </p>
      
      <div style="background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%); padding: 16px; border-radius: 12px; margin-bottom: 20px; font-size: 13px; border: 1px solid #dbeafe;">
        <p style="margin: 0 0 8px 0; color: #1e40af; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Element Info</p>
        <p style="margin: 6px 0; color: #374151;"><strong style="color: #1f2937;">Element:</strong> <code style="background: white; padding: 2px 6px; border-radius: 4px; font-size: 12px;">&lt;${element.tagName.toLowerCase()}&gt;</code></p>
        <p style="margin: 6px 0; color: #374151;"><strong style="color: #1f2937;">Text:</strong> ${originalText.substring(0, 100)}${originalText.length > 100 ? '...' : ''}</p>
        <p style="margin: 6px 0; color: #374151; word-break: break-all;"><strong style="color: #1f2937;">URL:</strong> ${window.location.href}</p>
      </div>
      
      ${translatedText ? `
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fef9e7 100%); padding: 16px; border-radius: 12px; margin-bottom: 20px; font-size: 13px; border: 1px solid #fde68a;">
          <p style="margin: 0 0 8px 0; color: #92400e; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">🌍 Translation Context</p>
          <p style="margin: 6px 0; color: #78716c;"><strong style="color: #57534e;">Original (${currentSourceLang || 'en'}):</strong> "${originalText.substring(0, 80)}${originalText.length > 80 ? '...' : ''}"</p>
          <p style="margin: 6px 0; color: #15803d; font-weight: 600;"><strong style="color: #166534;">Translated (${currentTargetLang || 'vi'}):</strong> "${translatedText.substring(0, 80)}${translatedText.length > 80 ? '...' : ''}"</p>
        </div>
      ` : ''}
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 13px; color: #374151;">${i18n('issueType')}</label>
        <div class="custom-select-wrapper" style="position: relative;">
          <button type="button" id="bug-category-btn" class="custom-select-button" style="width: 100%; padding: 12px 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: white; color: #1f2937; cursor: pointer; transition: all 0.2s; text-align: left; display: flex; align-items: center; justify-content: space-between;">
            <span id="bug-category-selected">${i18n('wrongTranslation')}</span>
            <img src="${chrome.runtime.getURL('icons/lucide/chevron-down.svg')}" width="20" height="20" style="opacity: 0.5; transition: transform 0.2s;">
          </button>
          <div id="bug-category-dropdown" class="custom-select-dropdown" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: white; border: 2px solid #e5e7eb; border-radius: 10px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); z-index: 1000; max-height: 240px; overflow-y: auto;">
            <div class="custom-select-option" data-value="translation" style="padding: 10px 14px; cursor: pointer; transition: all 0.15s; font-size: 13px; color: #1f2937;">${i18n('wrongTranslation')}</div>
            <div class="custom-select-option" data-value="overflow" style="padding: 10px 14px; cursor: pointer; transition: all 0.15s; font-size: 13px; color: #1f2937;">${i18n('textOverflow')}</div>
            <div class="custom-select-option" data-value="layout" style="padding: 10px 14px; cursor: pointer; transition: all 0.15s; font-size: 13px; color: #1f2937;">${i18n('layoutBroken')}</div>
            <div class="custom-select-option" data-value="missing" style="padding: 10px 14px; cursor: pointer; transition: all 0.15s; font-size: 13px; color: #1f2937;">${i18n('missingTranslation')}</div>
            <div class="custom-select-option" data-value="formatting" style="padding: 10px 14px; cursor: pointer; transition: all 0.15s; font-size: 13px; color: #1f2937;">${i18n('formattingIssue')}</div>
            <div class="custom-select-option" data-value="other" style="padding: 10px 14px; cursor: pointer; transition: all 0.15s; font-size: 13px; color: #1f2937;">${i18n('other')}</div>
          </div>
          <input type="hidden" id="bug-category" value="translation">
        </div>
      </div>
      
      <div style="margin-bottom: 24px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 13px; color: #374151;">Description:</label>
        <textarea id="localizeai-bug-notes" placeholder="${i18n('describeIssue')}" style="width: 100%; min-height: 100px; padding: 12px 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-family: inherit; font-size: 14px; resize: vertical; transition: all 0.2s; color: #1f2937;"></textarea>
      </div>
      
      <div style="display: flex; gap: 12px;">
        <button id="localizeai-submit-bug" style="flex: 1; padding: 14px 20px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);">
          <img src="${chrome.runtime.getURL('icons/lucide/save.svg')}" width="16" height="16" style="filter: brightness(0) invert(1);">
          Save Report
        </button>
        <button id="localizeai-cancel-bug" style="padding: 14px 24px; background: #f3f4f6; color: #374151; border: none; border-radius: 12px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s;">
          Cancel
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  // Setup custom select
  const selectBtn = document.getElementById('bug-category-btn');
  const selectDropdown = document.getElementById('bug-category-dropdown');
  const selectInput = document.getElementById('bug-category');
  const selectText = document.getElementById('bug-category-selected');
  const selectOptions = selectDropdown.querySelectorAll('.custom-select-option');
  
  selectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = selectDropdown.style.display === 'block';
    selectDropdown.style.display = isOpen ? 'none' : 'block';
    const chevron = selectBtn.querySelector('img');
    if (chevron) {
      chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    }
  });
  
  selectOptions.forEach(option => {
    option.addEventListener('click', () => {
      const value = option.dataset.value;
      const text = option.textContent;
      
      selectInput.value = value;
      selectText.textContent = text;
      selectDropdown.style.display = 'none';
      
      const chevron = selectBtn.querySelector('img');
      if (chevron) {
        chevron.style.transform = 'rotate(0deg)';
      }
      
      // Update selected state
      selectOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
    });
    
    option.addEventListener('mouseenter', () => {
      option.style.background = '#eff6ff';
    });
    
    option.addEventListener('mouseleave', () => {
      if (!option.classList.contains('selected')) {
        option.style.background = 'white';
      }
    });
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!selectBtn.contains(e.target) && !selectDropdown.contains(e.target)) {
      selectDropdown.style.display = 'none';
      const chevron = selectBtn.querySelector('img');
      if (chevron) {
        chevron.style.transform = 'rotate(0deg)';
      }
    }
  });
  
  // Set first option as selected
  if (selectOptions.length > 0) {
    selectOptions[0].classList.add('selected');
    selectOptions[0].style.background = '#eff6ff';
  }

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });

  document.getElementById('localizeai-submit-bug').addEventListener('click', async () => {
    const notes = document.getElementById('localizeai-bug-notes').value.trim();
    if (!notes) {
      showNotification(i18n('pleaseDescribeIssue'), 'alert-triangle');
      return;
    }
    
    const category = document.getElementById('bug-category').value;
    
    await submitBugReport(element, notes, category, originalText, translatedText);
    dialog.remove();
  });

  document.getElementById('localizeai-cancel-bug').addEventListener('click', () => {
    dialog.remove();
  });
}

async function submitBugReport(element, notes, category, originalText, translatedText) {
  try {
    const report = {
      url: window.location.href,
      pageTitle: document.title,
      element: {
        tag: element.tagName.toLowerCase(),
        text: element.textContent.substring(0, 200),
        html: element.outerHTML.substring(0, 500),
        xpath: getElementXPath(element),
        selector: getElementSelector(element)
      },
      translation: {
        original: originalText,
        translated: translatedText,
        sourceLang: currentSourceLang || 'en',
        targetLang: currentTargetLang || 'vi'
      },
      category,
      notes,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };

    await bugReportDB.addReport(report);
    showNotification(i18n('complete'), 'check-circle');
    
    // Update stats
    await updateBugReportStats();
  } catch (error) {
    console.error('Bug report error:', error);
    showNotification(i18n('noResultsFound'), 'x-circle');
  }
}

function getElementXPath(element) {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  const parts = [];
  let current = element;
  
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 0;
    let sibling = current.previousSibling;
    
    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }
    
    const tagName = current.nodeName.toLowerCase();
    const pathIndex = index > 0 ? `[${index + 1}]` : '';
    parts.unshift(`${tagName}${pathIndex}`);
    
    current = current.parentNode;
  }
  
  return parts.length ? `/${parts.join('/')}` : '';
}

function getElementSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  const path = [];
  let current = element;
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    if (current.className) {
      const classes = current.className.split(' ').filter(c => c && !c.includes('localizeai'));
      if (classes.length > 0) {
        selector += `.${classes[0]}`;
      }
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

async function updateBugReportStats() {
  try {
    let stats;
    
    // Get stats - if in panel, get from page; otherwise get locally
    if (isInSidePanel) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getBugReports' });
        const reports = response.reports || [];
        const openReports = reports.filter(r => r.status === 'open').length;
        stats = { open: openReports, total: reports.length };
      } catch (error) {
        console.error('Failed to get stats from page:', error);
        stats = { open: 0, total: 0 };
      }
    } else {
      stats = await bugReportDB.getStats();
    }
    
    // Update badge in sidebar
    const badge = document.getElementById('bug-report-badge');
    if (badge) {
      badge.textContent = stats.open;
      badge.style.display = stats.open > 0 ? 'inline-block' : 'none';
    }
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

// Notification helper with icon support
async function showNotification(message, iconName = 'info', duration = 3000) {
  // If action is from panel, DON'T show notification on page at all
  // The panel will handle showing its own notifications via setupButton feedback
  if (currentActionFromPanel && !isInSidePanel) {
    console.log('[Page] Notification suppressed (action from panel):', message);
    // Don't show anything on page when action is from panel
    return;
  }
  
  // Show notifications IN PANEL when in panel context
  // Show notifications ON PAGE when in page context
  
  // Determine target container
  let targetElement;
  if (isInSidePanel) {
    // In panel - append to panel container
    targetElement = document.getElementById('localizeai-panel') || document.body;
  } else {
    // On page - append to body
    targetElement = document.body;
  }
  
  // Remove any existing notifications first
  const existingNotifications = targetElement.querySelectorAll('.localizeai-notification');
  existingNotifications.forEach(notif => {
    notif.classList.remove('show');
    setTimeout(() => notif.remove(), 300);
  });
  
  const notification = document.createElement('div');
  notification.className = 'localizeai-notification';
  
  // ✅ Check if there's a dialog open (JSON translator, etc.)
  const hasOpenDialog = document.querySelector('.localizeai-dialog');
  if (hasOpenDialog) {
    notification.classList.add('from-dialog');
  }
  
  notification.style.display = 'flex';
  notification.style.alignItems = 'center';
  notification.style.gap = '8px';
  
  // Add Lucide icon
  if (iconName) {
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL(`icons/lucide/${iconName}.svg`);
    icon.style.width = '16px';
    icon.style.height = '16px';
    icon.style.flexShrink = '0';
    notification.appendChild(icon);
  }
  
  const text = document.createElement('span');
  text.textContent = message;
  notification.appendChild(text);
  
  // Append to appropriate location
  targetElement.appendChild(notification);
  
  // Log for debugging
  if (isInSidePanel) {
    console.log('[Panel] Notification created in panel:', message);
  } else if (hasOpenDialog) {
    console.log('[Dialog] Notification created from dialog:', message);
  }

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// Update usage display in sidebar - removed, only show modal when limit reached
function updateUsageDisplay(usageCount, limit, remaining) {
  // No longer display usage counter in UI
  // Only show upgrade modal when limit is reached (handled in translateText)
}

// Show sign in required notification (simple status message)
async function showSignInPrompt() {
  updateStatus(i18n('pleaseSignInToTranslate'), 'warning');
  showNotification(i18n('pleaseSignInToTranslate'), 'alert-triangle', 5000);
}



// Setup panel mode - override event handlers to communicate with active tab
async function setupPanelMode(tabId) {
  console.log(`[LocalizeAI] Setting up panel mode for tab ${tabId}`);
  
  // Clear previous polling interval if exists
  if (window.panelStatePollingInterval) {
    clearInterval(window.panelStatePollingInterval);
    console.log('[Panel] Cleared previous polling interval');
  }
  
  // Poll for state updates from page
  window.panelStatePollingInterval = setInterval(async () => {
    try {
      // Always get current active tab (in case it changed)
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab) return;
      
      const state = await chrome.tabs.sendMessage(currentTab.id, { action: 'getState' });
      if (state) {
        updatePanelUI(state);
      }
    } catch (error) {
      // Page not ready or no content script
    }
  }, 1000); // Check every second
  
  // Helper to send action to CURRENT active tab's content script
  async function sendToPage(action, data = {}) {
    try {
      // Always get current active tab (critical for tab switching!)
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab) {
        throw new Error('No active tab found');
      }
      
      console.log(`[Panel] Sending ${action} to tab ${currentTab.id}`);
      
      // Send message to content script on page with fromPanel flag
      const response = await chrome.tabs.sendMessage(currentTab.id, { 
        action, 
        ...data,
        fromPanel: true // Mark that this action is from panel
      });
      
      return response;
    } catch (error) {
      console.error('[Panel] Failed to send to page:', error);
      
      // Show error notification in panel
      showNotification(i18n('pageCommunicationError'), 'alert-triangle');
      
      return null;
    }
  }
  
  // Helper to setup button with page communication
  function setupButton(id, action, extraData = {}, notificationConfig = null) {
    const btn = document.getElementById(id);
    if (btn) {
      // Clone to remove old listeners
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', async () => {
        // Show notification in panel first (instant feedback)
        if (notificationConfig) {
          showNotification(notificationConfig.message, notificationConfig.icon, 2000);
        }
        
        // Then send action to page
        await sendToPage(action, extraData);
        
        // Immediately update UI after action
        try {
          const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (currentTab) {
            const state = await chrome.tabs.sendMessage(currentTab.id, { action: 'getState' });
            if (state) {
              updatePanelUI(state);
            }
          }
        } catch (error) {
          // Ignore errors
        }
      });
    }
  }
  
  // Helper to setup button with local execution (in panel)
  function setupLocalButton(id, handler) {
    const btn = document.getElementById(id);
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', handler);
    }
  }
  
  // Setup feature buttons with notifications
  // Actions that need page DOM access - send to page with panel notifications
  
  setupButton('show-original', 'showOriginal', {}, 
    { message: i18n('showingOriginalText'), icon: 'file-text' });
    
  // Setup show-translated button with dynamic language values
  const showTranslatedBtn = document.getElementById('show-translated');
  if (showTranslatedBtn) {
    const newBtn = showTranslatedBtn.cloneNode(true);
    showTranslatedBtn.parentNode.replaceChild(newBtn, showTranslatedBtn);
    
    newBtn.addEventListener('click', async () => {
      // Check authentication before showing translating notification
      const { user } = await chrome.storage.sync.get(['user']);
      if (!user) {
        showNotification(i18n('pleaseSignInToTranslate'), 'alert-triangle', 5000);
        // Scroll to sign in button
        setTimeout(() => {
          const signInBtn = document.getElementById('signin-btn');
          if (signInBtn) {
            signInBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
        return;
      }
      
      showNotification(i18n('translating'), 'globe', 2000);
      await sendToPage('showTranslated', {
        sourceLanguage: currentSourceLang,
        targetLanguage: currentTargetLang
      });
    });
  }
  
  setupButton('pseudo-loc-btn', 'pseudoLocalization', {},
    { message: i18n('applyingPseudoLoc'), icon: 'type' });
    
  setupButton('live-edit-btn', 'liveEdit', {},
    { message: i18n('togglingLiveEdit'), icon: 'edit' });
    
  // AI features - call functions directly to trigger shimmer effect
  const aiSuggestBtn = document.getElementById('ai-suggest-btn');
  if (aiSuggestBtn) {
    const newBtn = aiSuggestBtn.cloneNode(true);
    aiSuggestBtn.parentNode.replaceChild(newBtn, aiSuggestBtn);
    
    newBtn.addEventListener('click', async () => {
      // Call function directly to trigger shimmer in panel
      await showAISuggestions();
    });
  }
  
  const qualityCheckBtn = document.getElementById('quality-check-btn');
  if (qualityCheckBtn) {
    const newBtn = qualityCheckBtn.cloneNode(true);
    qualityCheckBtn.parentNode.replaceChild(newBtn, qualityCheckBtn);
    
    newBtn.addEventListener('click', async () => {
      // Call function directly to trigger shimmer in panel
      await runQualityCheck();
    });
  }
  
  const smartTranslateBtn = document.getElementById('smart-translate-btn');
  if (smartTranslateBtn) {
    const newBtn = smartTranslateBtn.cloneNode(true);
    smartTranslateBtn.parentNode.replaceChild(newBtn, smartTranslateBtn);
    
    newBtn.addEventListener('click', async () => {
      // Call function directly to trigger shimmer in panel
      await smartBatchTranslate();
    });
  }
    
  setupButton('bug-report-btn', 'reportBug', {},
    { message: i18n('togglingBugReport'), icon: 'flag' });
    
  setupButton('clear-cache-btn', 'clearCache', {},
    { message: i18n('clearingCache'), icon: 'trash-2' });
    
  setupButton('json-translator-btn', 'jsonTranslator', {},
    { message: i18n('openingJSONTranslator'), icon: 'file-json' });
  
  // Actions that run locally in panel (UI only)
  setupLocalButton('view-reports-btn', showBugReportSidebar);
  
  
  console.log('[LocalizeAI] Panel mode setup complete');
}


// Update panel UI based on page state
function updatePanelUI(state) {
  if (!isInSidePanel) return;
  
  // Update Live Edit button
  const liveEditBtn = document.getElementById('live-edit-btn');
  if (liveEditBtn) {
    if (state.liveEditEnabled) {
      liveEditBtn.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
      liveEditBtn.style.borderColor = '#3b82f6';
      liveEditBtn.style.color = '#1e40af';
      liveEditBtn.querySelector('span').textContent = i18n('disableLiveEdit') || 'Disable Live Edit';
    } else {
      liveEditBtn.style.background = '';
      liveEditBtn.style.borderColor = '';
      liveEditBtn.style.color = '';
      liveEditBtn.querySelector('span').textContent = i18n('enableLiveEdit') || 'Enable Live Edit';
    }
  }
  
  // Update Bug Report button
  const bugReportBtn = document.getElementById('bug-report-btn');
  if (bugReportBtn) {
    if (state.bugReportMode) {
      bugReportBtn.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
      bugReportBtn.style.borderColor = '#3b82f6';
      bugReportBtn.style.color = '#1e40af';
      bugReportBtn.querySelector('span').textContent = i18n('stopReporting') || 'Stop Reporting';
    } else {
      bugReportBtn.style.background = '';
      bugReportBtn.style.borderColor = '';
      bugReportBtn.style.color = '';
      bugReportBtn.querySelector('span').textContent = i18n('startReporting') || 'Start Reporting';
    }
  }
  
  // Update Pseudo-Loc button
  const pseudoLocBtn = document.getElementById('pseudo-loc-btn');
  if (pseudoLocBtn) {
    if (state.isPseudoLocActive) {
      pseudoLocBtn.innerHTML = `
        <img src="${chrome.runtime.getURL('icons/lucide/rotate-ccw.svg')}" class="btn-icon-sm" width="16" height="16">
        <span>${i18n('removePseudoLoc')}</span>
      `;
      pseudoLocBtn.classList.add('pseudo-loc-active');
    } else {
      pseudoLocBtn.innerHTML = `
        <img src="${chrome.runtime.getURL('icons/lucide/sliders.svg')}" class="btn-icon-sm" width="16" height="16">
        <span>${i18n('applyPseudoLoc')}</span>
      `;
      pseudoLocBtn.classList.remove('pseudo-loc-active');
    }
  }
  
  // Update translation toggle buttons
  const originalBtn = document.getElementById('show-original');
  const translatedBtn = document.getElementById('show-translated');
  if (originalBtn && translatedBtn) {
    if (state.isTranslated) {
      originalBtn.classList.remove('active');
      translatedBtn.classList.add('active');
    } else {
      originalBtn.classList.add('active');
      translatedBtn.classList.remove('active');
    }
  }
  
  // Update translation status
  const statusEl = document.getElementById('translation-status');
  if (statusEl) {
    const iconMap = {
      'info': 'info.svg',
      'success': 'check-circle.svg',
      'error': 'alert-triangle.svg',
      'warning': 'alert-circle.svg',
      'loading': 'loader.svg'
    };
    
    const iconName = iconMap[state.statusType] || 'info.svg';
    const shouldSpin = state.statusType === 'loading';
    
    statusEl.className = `status-text ${state.statusType}`;
    statusEl.innerHTML = `
      <img src="${chrome.runtime.getURL(`icons/lucide/${iconName}`)}" 
           class="status-icon ${shouldSpin ? 'spinning' : ''}" 
           width="16" 
           height="16">
      <span>${state.statusMessage || i18n('readyToTranslate')}</span>
    `;
  }
  
  // Update clear cache button visibility
  const clearBtn = document.getElementById('clear-cache-btn');
  if (clearBtn) {
    // Only show when translation is complete (not translating AND has translations AND is translated)
    if (state.translationCount > 0 && !state.isTranslating && state.isTranslated) {
      clearBtn.style.display = 'flex';
    } else {
      clearBtn.style.display = 'none';
    }
  }
}


// Show bug details dialog on page (called from panel)
function showBugDetailsOnPage(report) {
  const dialog = document.createElement('div');
  dialog.className = 'localizeai-dialog';
  dialog.innerHTML = `
    <div class="dialog-content bug-detail-modal-modern" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
      <div class="bug-detail-header">
        <div class="bug-detail-title-wrapper">
          <div class="bug-detail-icon-wrapper">
            <img src="${chrome.runtime.getURL('icons/lucide/bug.svg')}" width="20" height="20">
          </div>
          <h3 class="bug-detail-title">Bug Report #${report.id}</h3>
        </div>
        <button id="close-bug-details-page" class="bug-detail-close-btn">
          <img src="${chrome.runtime.getURL('icons/lucide/x.svg')}" width="18" height="18">
        </button>
      </div>
      
      <div class="bug-detail-section">
        <div class="bug-detail-section-header">
          <img src="${chrome.runtime.getURL('icons/lucide/info.svg')}" width="18" height="18" class="section-icon-detail">
          <h4>${i18n('basicInfo')}</h4>
        </div>
        <div class="bug-detail-info-grid">
          <div class="bug-detail-info-item">
            <span class="info-label">${i18n('status')}</span>
            <span class="info-value status-${report.status}">${report.status}</span>
          </div>
          <div class="bug-detail-info-item">
            <span class="info-label">${i18n('category')}</span>
            <span class="info-value">${report.category}</span>
          </div>
          <div class="bug-detail-info-item full-width">
            <span class="info-label">${i18n('date')}</span>
            <span class="info-value">${new Date(report.timestamp).toLocaleString()}</span>
          </div>
        </div>
      </div>
      
      <div class="bug-detail-section">
        <div class="bug-detail-section-header">
          <img src="${chrome.runtime.getURL('icons/lucide/code.svg')}" width="18" height="18" class="section-icon-detail">
          <h4>${i18n('elementDetails')}</h4>
        </div>
        <div class="bug-detail-info-grid">
          <div class="bug-detail-info-item">
            <span class="info-label">${i18n('tag')}</span>
            <span class="info-value code">&lt;${report.element.tag}&gt;</span>
          </div>
          <div class="bug-detail-info-item full-width">
            <span class="info-label">${i18n('text')}</span>
            <span class="info-value">${report.element.text}</span>
          </div>
          <div class="bug-detail-info-item full-width">
            <span class="info-label">${i18n('selector')}</span>
            <code class="info-code">${report.element.selector}</code>
          </div>
        </div>
      </div>
      
      ${report.translation && report.translation.translated ? `
        <div class="bug-detail-section">
          <div class="bug-detail-section-header">
            <img src="${chrome.runtime.getURL('icons/lucide/languages.svg')}" width="18" height="18" class="section-icon-detail">
            <h4>${i18n('translationContext')}</h4>
          </div>
          <div class="bug-detail-info-grid">
            <div class="bug-detail-info-item full-width">
              <span class="info-label">${i18n('source')}</span>
              <span class="info-value">${report.translation.sourceLang} → ${report.translation.targetLang}</span>
            </div>
            <div class="bug-detail-translation-box">
              <div class="translation-item">
                <span class="translation-label">${i18n('original')}</span>
                <p class="translation-text original">"${report.translation.original}"</p>
              </div>
              <div class="translation-item">
                <span class="translation-label">${i18n('translated')}</span>
                <p class="translation-text translated">"${report.translation.translated}"</p>
              </div>
            </div>
          </div>
        </div>
      ` : ''}
      
      <div class="bug-detail-section issue">
        <div class="bug-detail-section-header">
          <img src="${chrome.runtime.getURL('icons/lucide/alert-circle.svg')}" width="18" height="18" class="section-icon-detail">
          <h4>${i18n('issueDescription')}</h4>
        </div>
        <p class="bug-detail-issue-text">${report.notes}</p>
      </div>
      
      <div class="bug-detail-section page">
        <div class="bug-detail-section-header">
          <img src="${chrome.runtime.getURL('icons/lucide/globe.svg')}" width="18" height="18" class="section-icon-detail">
          <h4>${i18n('pageInfo')}</h4>
        </div>
        <div class="bug-detail-info-grid">
          <div class="bug-detail-info-item full-width">
            <span class="info-label">${i18n('title')}</span>
            <span class="info-value">${report.pageTitle}</span>
          </div>
          <div class="bug-detail-info-item full-width">
            <span class="info-label">${i18n('url')}</span>
            <a href="${report.url}" target="_blank" class="info-link">${report.url}</a>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  document.getElementById('close-bug-details-page').addEventListener('click', () => dialog.remove());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.remove();
  });
}
