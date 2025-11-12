// i18n Helper - Simplifies using Chrome Extension i18n API
// Usage: i18n('key') or i18n('key', 'substitution1', 'substitution2')

/**
 * Get localized message
 * @param {string} key - Message key from messages.json
 * @param {...string} substitutions - Optional substitution values
 * @returns {string} Localized message
 */
function i18n(key, ...substitutions) {
  if (substitutions.length > 0) {
    return chrome.i18n.getMessage(key, substitutions);
  }
  return chrome.i18n.getMessage(key) || key;
}

/**
 * Get current UI language
 * @returns {string} Language code (e.g., 'en', 'vi')
 */
function getUILanguage() {
  return chrome.i18n.getUILanguage();
}

/**
 * Replace all __MSG_*__ placeholders in HTML with localized text
 * @param {HTMLElement} element - Root element to process
 */
function localizeHTML(element = document) {
  // Find all text nodes and attributes with __MSG_*__ pattern
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    null
  );

  const nodes = [];
  let node;
  while (node = walker.nextNode()) {
    nodes.push(node);
  }

  nodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Replace in text nodes
      const text = node.textContent;
      if (text.includes('__MSG_')) {
        node.textContent = text.replace(/__MSG_(\w+)__/g, (match, key) => {
          return i18n(key);
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Replace in attributes (title, placeholder, aria-label, etc.)
      const attrs = ['title', 'placeholder', 'aria-label', 'alt'];
      attrs.forEach(attr => {
        const value = node.getAttribute(attr);
        if (value && value.includes('__MSG_')) {
          node.setAttribute(attr, value.replace(/__MSG_(\w+)__/g, (match, key) => {
            return i18n(key);
          }));
        }
      });
    }
  });
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.i18n = i18n;
  window.getUILanguage = getUILanguage;
  window.localizeHTML = localizeHTML;
}
