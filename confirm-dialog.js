// Custom Confirm Dialog - Modern Design
function showConfirmDialog(title, message, confirmText = null, cancelText = null, isDanger = false) {
  // Use i18n defaults if not provided
  confirmText = confirmText || i18n('confirm');
  cancelText = cancelText || i18n('cancel');
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'localizeai-dialog';
    dialog.style.zIndex = '10000000';
    
    const iconSrc = isDanger 
      ? chrome.runtime.getURL('icons/lucide/alert-triangle.svg')
      : chrome.runtime.getURL('icons/lucide/help-circle.svg');
    
    dialog.innerHTML = `
      <div class="dialog-content confirm-dialog-modern" style="max-width: 420px;">
        <div class="confirm-dialog-icon-wrapper ${isDanger ? 'danger' : ''}">
          <img src="${iconSrc}" width="32" height="32" class="confirm-dialog-icon">
        </div>
        
        <div class="confirm-dialog-content">
          <h3 class="confirm-dialog-title">${title}</h3>
          <p class="confirm-dialog-message">${message}</p>
        </div>
        
        <div class="confirm-dialog-actions">
          <button class="confirm-dialog-btn-modern cancel" id="confirm-cancel">
            <img src="${chrome.runtime.getURL('icons/lucide/x.svg')}" width="16" height="16">
            ${cancelText}
          </button>
          <button class="confirm-dialog-btn-modern confirm ${isDanger ? 'danger' : ''}" id="confirm-ok">
            <img src="${chrome.runtime.getURL('icons/lucide/check.svg')}" width="16" height="16">
            ${confirmText}
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Focus on confirm button
    setTimeout(() => {
      document.getElementById('confirm-ok').focus();
    }, 100);
    
    // Handle confirm
    document.getElementById('confirm-ok').addEventListener('click', () => {
      dialog.remove();
      resolve(true);
    });
    
    // Handle cancel
    document.getElementById('confirm-cancel').addEventListener('click', () => {
      dialog.remove();
      resolve(false);
    });
    
    // Handle ESC key
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        dialog.remove();
        resolve(false);
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
    
    // Handle click outside
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
        resolve(false);
      }
    });
  });
}

// Custom Alert Dialog
function showAlertDialog(title, message, buttonText = null) {
  buttonText = buttonText || i18n('ok');
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'localizeai-dialog';
    dialog.style.zIndex = '10000000';
    
    dialog.innerHTML = `
      <div class="dialog-content confirm-dialog-modern" style="max-width: 420px;">
        <div class="confirm-dialog-icon-wrapper">
          <img src="${chrome.runtime.getURL('icons/lucide/info.svg')}" width="32" height="32" class="confirm-dialog-icon">
        </div>
        
        <div class="confirm-dialog-content">
          <h3 class="confirm-dialog-title">${title}</h3>
          <p class="confirm-dialog-message">${message}</p>
        </div>
        
        <div class="confirm-dialog-actions">
          <button class="confirm-dialog-btn-modern confirm" id="alert-ok" style="width: 100%;">
            <img src="${chrome.runtime.getURL('icons/lucide/check.svg')}" width="16" height="16">
            ${buttonText}
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Focus on button
    setTimeout(() => {
      document.getElementById('alert-ok').focus();
    }, 100);
    
    // Handle OK
    document.getElementById('alert-ok').addEventListener('click', () => {
      dialog.remove();
      resolve(true);
    });
    
    // Handle ESC key
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        dialog.remove();
        resolve(true);
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
    
    // Handle click outside
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
        resolve(true);
      }
    });
  });
}
