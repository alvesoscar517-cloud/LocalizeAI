// Bug Report Sidebar - Modern, Clean UI
async function showBugReportSidebar() {
  // Hide main sidebar
  const mainSidebar = document.querySelector('.localizeai-sidebar');
  if (mainSidebar) {
    mainSidebar.style.display = 'none';
  }
  
  // Get reports
  const reports = await bugReportDB.getAllReports();
  
  // Sort by timestamp descending
  reports.sort((a, b) => b.timestamp - a.timestamp);
  
  // Create bug report view inside main panel
  const panel = document.getElementById('localizeai-panel');
  if (!panel) return;
  
  // Create bug sidebar content
  const bugContent = document.createElement('div');
  bugContent.id = 'bug-report-sidebar';
  bugContent.className = 'localizeai-sidebar show';
  bugContent.innerHTML = `
    <div class="bug-sidebar-header">
      <div class="bug-sidebar-title">
        <button class="bug-sidebar-back" id="back-to-main-sidebar">
          <img src="${chrome.runtime.getURL('icons/lucide/arrow-left.svg')}" width="20" height="20">
        </button>
        <img src="${chrome.runtime.getURL('icons/lucide/bug.svg')}" width="24" height="24">
        <h3>${i18n('bugReports')}</h3>
      </div>
      <button class="bug-sidebar-close" id="close-bug-sidebar">
        <img src="${chrome.runtime.getURL('icons/lucide/x.svg')}" width="20" height="20">
      </button>
    </div>
    
    <div class="bug-sidebar-search">
      <div class="search-wrapper">
        <img src="${chrome.runtime.getURL('icons/lucide/search.svg')}" width="16" height="16" class="search-icon">
        <input type="text" id="bug-search-input" placeholder="${i18n('searchReports')}" autocomplete="off">
      </div>
    </div>
    
    <div class="bug-sidebar-actions">
      <button class="bug-action-btn primary" id="export-bugs-btn">
        <img src="${chrome.runtime.getURL('icons/lucide/download.svg')}" width="16" height="16">
        ${i18n('export')}
      </button>
      <button class="bug-action-btn danger" id="clear-bugs-btn">
        <img src="${chrome.runtime.getURL('icons/lucide/trash-2.svg')}" width="16" height="16">
        ${i18n('clearAll')}
      </button>
    </div>
    
    <div class="bug-sidebar-content" id="bug-cards-container">
      ${reports.length === 0 ? createEmptyState() : reports.map(report => createBugCard(report)).join('')}
    </div>
  `;
  
  panel.appendChild(bugContent);
  
  // Event listeners
  document.getElementById('back-to-main-sidebar').addEventListener('click', closeBugSidebar);
  
  document.getElementById('close-bug-sidebar').addEventListener('click', () => {
    closeBugSidebar();
    // Also close main panel
    const mainPanel = document.getElementById('localizeai-panel');
    if (mainPanel) {
      mainPanel.style.display = 'none';
      document.body.classList.remove('localizeai-sidebar-open');
    }
  });
  
  document.getElementById('export-bugs-btn').addEventListener('click', () => exportBugsMenu(reports));
  document.getElementById('clear-bugs-btn').addEventListener('click', clearAllBugs);
  
  // Search functionality with highlight
  const searchInput = document.getElementById('bug-search-input');
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = reports.filter(report => 
      report.notes.toLowerCase().includes(searchTerm) ||
      report.element.text.toLowerCase().includes(searchTerm) ||
      report.category.toLowerCase().includes(searchTerm) ||
      report.status.toLowerCase().includes(searchTerm) ||
      `#${report.id}`.includes(searchTerm)
    );
    
    const container = document.getElementById('bug-cards-container');
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="bug-empty-state">
          <img src="${chrome.runtime.getURL('icons/lucide/search-x.svg')}" class="bug-empty-icon">
          <h4>${i18n('noResultsFound')}</h4>
          <p>${i18n('tryDifferentKeywords')}</p>
        </div>
      `;
    } else {
      container.innerHTML = filtered.map(report => createBugCard(report, searchTerm)).join('');
    }
  });
  
  // Event delegation for card actions
  const cardsContainer = document.getElementById('bug-cards-container');
  cardsContainer.addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    
    const action = button.dataset.action;
    const id = parseInt(button.dataset.id);
    
    if (action === 'view') {
      await viewBugDetails(id);
    } else if (action === 'toggle') {
      await toggleBugStatus(id);
    } else if (action === 'delete') {
      await deleteBug(id);
    }
  });
}

function closeBugSidebar() {
  // Remove bug sidebar
  const bugSidebar = document.getElementById('bug-report-sidebar');
  if (bugSidebar) {
    bugSidebar.remove();
  }
  
  // Show main sidebar again
  const mainSidebar = document.querySelector('.localizeai-sidebar');
  if (mainSidebar) {
    mainSidebar.style.display = 'flex';
  }
}

function createEmptyState() {
  return `
    <div class="bug-empty-state">
      <img src="${chrome.runtime.getURL('icons/lucide/inbox.svg')}" class="bug-empty-icon">
      <h4>${i18n('noBugReportsYet')}</h4>
      <p>${i18n('clickStartReporting')}</p>
    </div>
  `;
}

function highlightText(text, searchTerm) {
  if (!searchTerm || searchTerm.trim() === '') return text;
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<span class="search-highlight">$1</span>');
}

function createBugCard(report, searchTerm = '') {
  const date = new Date(report.timestamp);
  const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const elementText = report.element.text.substring(0, 100) + (report.element.text.length > 100 ? '...' : '');
  const highlightedElementText = highlightText(elementText, searchTerm);
  const highlightedNotes = highlightText(report.notes, searchTerm);
  
  return `
    <div class="bug-card-modern" data-report-id="${report.id}">
      <div class="bug-card-header-modern">
        <div class="bug-card-id-modern">#${report.id}</div>
        <div class="bug-card-badges-modern">
          <span class="bug-badge-modern ${report.status === 'open' ? 'status-open' : 'status-resolved'}">${report.status}</span>
        </div>
      </div>
      
      <div class="bug-card-text-modern">
        ${highlightedElementText}
      </div>
      
      <div class="bug-card-issue-modern">
        ${highlightedNotes}
      </div>
      
      <div class="bug-card-footer-modern">
        <div class="bug-card-meta-modern">
          <img src="${chrome.runtime.getURL('icons/lucide/clock.svg')}" width="12" height="12">
          <span>${dateStr}</span>
        </div>
        <div class="bug-card-actions-modern">
          <button class="bug-card-btn-modern view" data-action="view" data-id="${report.id}" title="${i18n('viewDetails')}">
            <img src="${chrome.runtime.getURL('icons/lucide/eye.svg')}" width="14" height="14">
          </button>
          <button class="bug-card-btn-modern toggle" data-action="toggle" data-id="${report.id}" title="${report.status === 'open' ? i18n('markAsResolved') : i18n('reopen')}">
            <img src="${chrome.runtime.getURL('icons/lucide/' + (report.status === 'open' ? 'check' : 'rotate-ccw') + '.svg')}" width="14" height="14">
          </button>
          <button class="bug-card-btn-modern delete" data-action="delete" data-id="${report.id}" title="${i18n('delete')}">
            <img src="${chrome.runtime.getURL('icons/lucide/trash-2.svg')}" width="14" height="14">
          </button>
        </div>
      </div>
    </div>
  `;
}

async function viewBugDetails(id) {
  const report = await bugReportDB.getReportById(id);
  if (!report) return;
  
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
        <button id="close-bug-details" class="bug-detail-close-btn">
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
      
      ${report.translation.translated ? `
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
  
  document.getElementById('close-bug-details').addEventListener('click', () => dialog.remove());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.remove();
  });
}

// Refresh bug list without recreating entire sidebar (prevents flash)
async function refreshBugList() {
  const reports = await bugReportDB.getAllReports();
  reports.sort((a, b) => b.timestamp - a.timestamp);
  
  const container = document.getElementById('bug-cards-container');
  if (!container) return;
  
  // Update content smoothly
  container.style.opacity = '0.5';
  container.style.transition = 'opacity 0.15s ease';
  
  setTimeout(() => {
    container.innerHTML = reports.length === 0 ? createEmptyState() : reports.map(report => createBugCard(report)).join('');
    container.style.opacity = '1';
  }, 150);
}

async function toggleBugStatus(id) {
  const report = await bugReportDB.getReportById(id);
  const newStatus = report.status === 'open' ? 'resolved' : 'open';
  
  await bugReportDB.updateReport(id, { status: newStatus });
  showNotification(i18n('reportMarkedAs', id, newStatus), 'check-circle');
  
  // Refresh list smoothly instead of recreating sidebar
  await refreshBugList();
  await updateBugReportStats();
}

async function deleteBug(id) {
  const confirmed = await showConfirmDialog(
    i18n('deleteReport'),
    i18n('deleteReportConfirm', id),
    i18n('delete'),
    i18n('cancel')
  );
  
  if (!confirmed) return;
  
  await bugReportDB.deleteReport(id);
  showNotification(i18n('reportDeleted', id), 'trash-2');
  
  // Refresh list smoothly instead of recreating sidebar
  await refreshBugList();
  await updateBugReportStats();
}

async function clearAllBugs() {
  const confirmed = await showConfirmDialog(
    i18n('clearAllReports'),
    i18n('clearAllReportsConfirm'),
    i18n('deleteAll'),
    i18n('cancel'),
    true
  );
  
  if (!confirmed) return;
  
  await bugReportDB.clearAll();
  showNotification(i18n('allReportsCleared'), 'trash-2');
  
  // Refresh list smoothly instead of recreating sidebar
  await refreshBugList();
  await updateBugReportStats();
}

function exportBugsMenu(reports) {
  const dialog = document.createElement('div');
  dialog.className = 'localizeai-dialog';
  dialog.innerHTML = `
    <div class="dialog-content export-menu-modern" style="max-width: 420px; box-sizing: border-box;">
      <div class="export-menu-header">
        <div class="export-icon-wrapper">
          <img src="${chrome.runtime.getURL('icons/lucide/download.svg')}" width="24" height="24">
        </div>
        <h3 class="export-menu-title">${i18n('exportBugReports')}</h3>
        <p class="export-menu-subtitle">${i18n('chooseExportFormat')}</p>
      </div>
      
      <div class="export-menu-options">
        <button id="export-excel" class="export-option-btn excel">
          <img src="${chrome.runtime.getURL('icons/lucide/file-spreadsheet.svg')}" width="20" height="20">
          <span>${i18n('exportToExcel')}</span>
        </button>
        
        <button id="export-json" class="export-option-btn json">
          <img src="${chrome.runtime.getURL('icons/lucide/file-json.svg')}" width="20" height="20">
          <span>${i18n('exportToJSON')}</span>
        </button>
        
        <button id="sync-drive" class="export-option-btn drive">
          <img src="${chrome.runtime.getURL('icons/lucide/cloud-upload.svg')}" width="20" height="20">
          <span>${i18n('syncToGoogleDrive')}</span>
        </button>
      </div>
      
      <button id="close-export-menu" class="export-cancel-btn">
        <img src="${chrome.runtime.getURL('icons/lucide/x.svg')}" width="16" height="16">
        ${i18n('cancel')}
      </button>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  document.getElementById('export-excel').addEventListener('click', async () => {
    try {
      await exportToExcel(reports);
    } catch (error) {
      console.error('Export to Excel failed:', error);
      showNotification('Failed to export to Excel. Please try again.', 'x-circle');
    }
    dialog.remove();
  });
  
  document.getElementById('export-json').addEventListener('click', () => {
    exportToJSON(reports);
    dialog.remove();
  });
  
  document.getElementById('sync-drive').addEventListener('click', async () => {
    await syncReportsToDrive();
    dialog.remove();
  });
  
  document.getElementById('close-export-menu').addEventListener('click', () => dialog.remove());
  
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.remove();
  });
}
