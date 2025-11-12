// Bug Report Manager UI
async function showBugReportManager() {
  const reports = await bugReportDB.getAllReports();
  const stats = await bugReportDB.getStats();
  
  // Sort by timestamp descending
  reports.sort((a, b) => b.timestamp - a.timestamp);
  
  const dialog = document.createElement('div');
  dialog.className = 'localizeai-dialog';
  dialog.id = 'bug-report-manager';
  dialog.innerHTML = `
    <div class="dialog-content" style="max-width: 1200px; max-height: 90vh; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${chrome.runtime.getURL('icons/lucide/bug.svg')}" width="28" height="28" style="color: #667eea;">
          <div>
            <h3 style="margin: 0 0 5px 0; font-size: 24px; color: #1a1a1a;">${i18n('bugReportManager')}</h3>
            <p style="margin: 0; font-size: 13px; color: #666; display: flex; align-items: center; gap: 6px;">
              <img src="${chrome.runtime.getURL('icons/lucide/info.svg')}" width="14" height="14">
              ${i18n('manageAndExportIssues')}
            </p>
          </div>
        </div>
        <button id="close-manager" style="padding: 8px 16px; background: #f5f5f5; border: none; border-radius: 10px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
          <img src="${chrome.runtime.getURL('icons/lucide/x.svg')}" width="16" height="16">
          ${i18n('close')}
        </button>
      </div>
      
      <!-- Stats Dashboard -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <img src="${chrome.runtime.getURL('icons/lucide/file-text.svg')}" width="24" height="24" style="filter: brightness(0) invert(1);">
            <div style="font-size: 14px; opacity: 0.9;">${i18n('totalReports')}</div>
          </div>
          <div style="font-size: 36px; font-weight: bold;">${stats.total}</div>
        </div>
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(240, 147, 251, 0.3);">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <img src="${chrome.runtime.getURL('icons/lucide/alert-circle.svg')}" width="24" height="24" style="filter: brightness(0) invert(1);">
            <div style="font-size: 14px; opacity: 0.9;">${i18n('openIssues')}</div>
          </div>
          <div style="font-size: 36px; font-weight: bold;">${stats.open}</div>
        </div>
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <img src="${chrome.runtime.getURL('icons/lucide/check-circle.svg')}" width="24" height="24" style="filter: brightness(0) invert(1);">
            <div style="font-size: 14px; opacity: 0.9;">${i18n('resolved')}</div>
          </div>
          <div style="font-size: 36px; font-weight: bold;">${stats.resolved}</div>
        </div>
        <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(250, 112, 154, 0.3);">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <img src="${chrome.runtime.getURL('icons/lucide/alert-triangle.svg')}" width="24" height="24" style="filter: brightness(0) invert(1);">
            <div style="font-size: 14px; opacity: 0.9;">${i18n('highPriority')}</div>
          </div>
          <div style="font-size: 36px; font-weight: bold;">${stats.bySeverity.high}</div>
        </div>
      </div>
      
      <!-- Actions Bar -->
      <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
        <button id="sync-to-drive-btn" style="flex: 1; min-width: 150px; padding: 12px 20px; background: #667eea; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
          <img src="${chrome.runtime.getURL('icons/lucide/cloud-upload.svg')}" width="18" height="18" style="filter: brightness(0) invert(1);">
          ${i18n('syncToDrive')}
        </button>
        <button id="sync-from-drive-btn" style="flex: 1; min-width: 150px; padding: 12px 20px; background: #764ba2; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
          <img src="${chrome.runtime.getURL('icons/lucide/cloud-download.svg')}" width="18" height="18" style="filter: brightness(0) invert(1);">
          ${i18n('syncFromDrive')}
        </button>
        <button id="export-excel-btn" style="flex: 1; min-width: 150px; padding: 12px 20px; background: #28a745; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
          <img src="${chrome.runtime.getURL('icons/lucide/file-spreadsheet.svg')}" width="18" height="18" style="filter: brightness(0) invert(1);">
          ${i18n('exportExcel')}
        </button>
        <button id="export-json-btn" style="flex: 1; min-width: 150px; padding: 12px 20px; background: #17a2b8; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
          <img src="${chrome.runtime.getURL('icons/lucide/file-json.svg')}" width="18" height="18" style="filter: brightness(0) invert(1);">
          ${i18n('exportJSON')}
        </button>
        <button id="clear-all-btn" style="padding: 12px 20px; background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
          <img src="${chrome.runtime.getURL('icons/lucide/trash-2.svg')}" width="18" height="18" style="filter: brightness(0) invert(1);">
          ${i18n('clearAll')}
        </button>
      </div>
      
      <!-- Filters -->
      <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
        <select id="filter-status" style="padding: 10px 14px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 13px; background: white; cursor: pointer; transition: all 0.2s;">
          <option value="all">${i18n('allStatus')}</option>
          <option value="open">${i18n('open')}</option>
          <option value="resolved">${i18n('resolved')}</option>
        </select>
        <select id="filter-severity" style="padding: 10px 14px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 13px; background: white; cursor: pointer; transition: all 0.2s;">
          <option value="all">${i18n('allSeverity')}</option>
          <option value="high">${i18n('high')}</option>
          <option value="medium">${i18n('medium')}</option>
          <option value="low">${i18n('low')}</option>
        </select>
        <select id="filter-category" style="padding: 10px 14px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 13px; background: white; cursor: pointer; transition: all 0.2s;">
          <option value="all">${i18n('allCategories')}</option>
          <option value="translation">${i18n('wrongTranslation')}</option>
          <option value="overflow">${i18n('textOverflow')}</option>
          <option value="layout">${i18n('layoutBroken')}</option>
          <option value="missing">${i18n('missingTranslation')}</option>
          <option value="formatting">${i18n('formattingIssue')}</option>
          <option value="other">${i18n('other')}</option>
        </select>
        <div style="flex: 1; min-width: 200px; position: relative;">
          <img src="${chrome.runtime.getURL('icons/lucide/search.svg')}" width="16" height="16" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #999;">
          <input type="text" id="search-reports" placeholder="${i18n('searchReports')}" style="width: 100%; padding: 10px 14px 10px 38px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 13px; transition: all 0.2s;">
        </div>
      </div>
      
      <!-- Reports List -->
      <div id="reports-list" style="flex: 1; overflow-y: auto; border: 2px solid #e0e0e0; border-radius: 12px; padding: 15px; background: #f8f9fa;">
        ${reports.length === 0 ? `
          <div style="text-align: center; padding: 60px 20px; color: #999;">
            <img src="${chrome.runtime.getURL('icons/lucide/inbox.svg')}" width="80" height="80" style="opacity: 0.3; margin-bottom: 20px;">
            <h4 style="margin: 0 0 10px 0; color: #666;">${i18n('noBugReportsYet')}</h4>
            <p style="margin: 0; font-size: 14px;">${i18n('startReportingIssues')}</p>
          </div>
        ` : reports.map(report => createReportCard(report)).join('')}
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // Event listeners
  document.getElementById('close-manager').addEventListener('click', () => dialog.remove());
  document.getElementById('sync-to-drive-btn').addEventListener('click', syncReportsToDrive);
  document.getElementById('sync-from-drive-btn').addEventListener('click', syncReportsFromDrive);
  document.getElementById('export-excel-btn').addEventListener('click', () => exportToExcel(reports));
  document.getElementById('export-json-btn').addEventListener('click', () => exportToJSON(reports));
  document.getElementById('clear-all-btn').addEventListener('click', clearAllReports);
  
  // Filters
  const filterStatus = document.getElementById('filter-status');
  const filterSeverity = document.getElementById('filter-severity');
  const filterCategory = document.getElementById('filter-category');
  const searchInput = document.getElementById('search-reports');
  
  const applyFilters = () => {
    const status = filterStatus.value;
    const severity = filterSeverity.value;
    const category = filterCategory.value;
    const search = searchInput.value.toLowerCase();
    
    let filtered = reports;
    
    if (status !== 'all') {
      filtered = filtered.filter(r => r.status === status);
    }
    if (severity !== 'all') {
      filtered = filtered.filter(r => r.severity === severity);
    }
    if (category !== 'all') {
      filtered = filtered.filter(r => r.category === category);
    }
    if (search) {
      filtered = filtered.filter(r => 
        r.notes.toLowerCase().includes(search) ||
        r.url.toLowerCase().includes(search) ||
        r.element.text.toLowerCase().includes(search)
      );
    }
    
    const listEl = document.getElementById('reports-list');
    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #999;">
          <img src="${chrome.runtime.getURL('icons/lucide/search.svg')}" width="64" height="64" style="opacity: 0.3; margin-bottom: 15px;">
          <p style="margin: 0; font-size: 14px;">${i18n('noReportsMatchFilters')}</p>
        </div>
      `;
    } else {
      listEl.innerHTML = filtered.map(report => createReportCard(report)).join('');
    }
  };
  
  filterStatus.addEventListener('change', applyFilters);
  filterSeverity.addEventListener('change', applyFilters);
  filterCategory.addEventListener('change', applyFilters);
  searchInput.addEventListener('input', applyFilters);
  
  // Close on overlay click
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });
}

function createReportCard(report) {
  const severityColors = {
    high: '#81c784',
    medium: '#a5d6a7',
    low: '#66bb6a'
  };
  
  const severityIcons = {
    high: 'alert-octagon',
    medium: 'alert-triangle',
    low: 'info'
  };
  
  const categoryIcons = {
    translation: 'languages',
    overflow: 'maximize-2',
    layout: 'layout',
    missing: 'file-x',
    formatting: 'type',
    other: 'help-circle'
  };
  
  const date = new Date(report.timestamp);
  const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  
  return `
    <div class="report-card" data-report-id="${report.id}" style="background: white; border: 2px solid #e0e0e0; border-radius: 12px; padding: 18px; margin-bottom: 15px; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 14px;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
            <span style="font-weight: bold; font-size: 18px; color: #667eea;">#${report.id}</span>
            <span style="background: ${severityColors[report.severity]}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
              <img src="${chrome.runtime.getURL('icons/lucide/' + severityIcons[report.severity] + '.svg')}" width="12" height="12" style="filter: brightness(0) invert(1);">
              ${report.severity.toUpperCase()}
            </span>
            <span style="background: #667eea; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
              <img src="${chrome.runtime.getURL('icons/lucide/' + categoryIcons[report.category] + '.svg')}" width="12" height="12" style="filter: brightness(0) invert(1);">
              ${report.category}
            </span>
            <span style="background: ${report.status === 'open' ? '#f093fb' : '#43e97b'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
              <img src="${chrome.runtime.getURL('icons/lucide/' + (report.status === 'open' ? 'unlock' : 'check-circle') + '.svg')}" width="12" height="12" style="filter: brightness(0) invert(1);">
              ${report.status === 'open' ? 'OPEN' : 'RESOLVED'}
            </span>
          </div>
          <div style="font-size: 12px; color: #999; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <span style="display: flex; align-items: center; gap: 4px;">
              <img src="${chrome.runtime.getURL('icons/lucide/calendar.svg')}" width="14" height="14">
              ${dateStr}
            </span>
            <span style="display: flex; align-items: center; gap: 4px;">
              <img src="${chrome.runtime.getURL('icons/lucide/globe.svg')}" width="14" height="14">
              ${report.pageTitle || i18n('untitledPage')}
            </span>
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button onclick="viewReportDetails(${report.id})" style="padding: 8px 14px; background: #667eea; color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
            <img src="${chrome.runtime.getURL('icons/lucide/eye.svg')}" width="14" height="14" style="filter: brightness(0) invert(1);">
            ${i18n('view')}
          </button>
          <button onclick="toggleReportStatus(${report.id})" style="padding: 8px 14px; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
            <img src="${chrome.runtime.getURL('icons/lucide/' + (report.status === 'open' ? 'check' : 'unlock') + '.svg')}" width="14" height="14" style="filter: brightness(0) invert(1);">
          </button>
          <button onclick="deleteReport(${report.id})" style="padding: 8px 14px; background: linear-gradient(135deg, #81c784 0%, #66bb6a 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
            <img src="${chrome.runtime.getURL('icons/lucide/trash-2.svg')}" width="14" height="14" style="filter: brightness(0) invert(1);">
          </button>
        </div>
      </div>
      
      <div style="background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%); padding: 14px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #667eea;">
        <div style="font-size: 13px; color: #333; margin-bottom: 8px; display: flex; align-items: start; gap: 8px;">
          <img src="${chrome.runtime.getURL('icons/lucide/code.svg')}" width="16" height="16" style="flex-shrink: 0; margin-top: 2px;">
          <div>
            <strong>${i18n('element')}:</strong> &lt;${report.element.tag}&gt;<br>
            <span style="color: #666; font-size: 12px;">"${report.element.text.substring(0, 100)}${report.element.text.length > 100 ? '...' : ''}"</span>
          </div>
        </div>
        ${report.translation.translated ? `
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
            <div style="font-size: 12px; color: #666; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <img src="${chrome.runtime.getURL('icons/lucide/arrow-right.svg')}" width="14" height="14">
              <strong>${i18n('original')}:</strong> "${report.translation.original.substring(0, 60)}${report.translation.original.length > 60 ? '...' : ''}"
            </div>
            <div style="font-size: 12px; color: #28a745; font-weight: 600; display: flex; align-items: center; gap: 6px;">
              <img src="${chrome.runtime.getURL('icons/lucide/check.svg')}" width="14" height="14">
              <strong>${i18n('translated')}:</strong> "${report.translation.translated.substring(0, 60)}${report.translation.translated.length > 60 ? '...' : ''}"
            </div>
          </div>
        ` : ''}
      </div>
      
      <div style="font-size: 13px; color: #333; margin-bottom: 12px; padding: 12px; background: #fff8e1; border-radius: 8px; border-left: 4px solid #ffc107;">
        <div style="display: flex; align-items: start; gap: 8px;">
          <img src="${chrome.runtime.getURL('icons/lucide/message-square.svg')}" width="16" height="16" style="flex-shrink: 0; margin-top: 2px;">
          <div>
            <strong>${i18n('issue')}:</strong><br>
            <span style="color: #666;">${report.notes}</span>
          </div>
        </div>
      </div>
      
      <div style="font-size: 12px; color: #999; display: flex; align-items: center; gap: 6px;">
        <img src="${chrome.runtime.getURL('icons/lucide/link.svg')}" width="14" height="14">
        <strong>URL:</strong> <a href="${report.url}" target="_blank" style="color: #667eea; text-decoration: none; word-break: break-all;">${report.url.substring(0, 80)}${report.url.length > 80 ? '...' : ''}</a>
      </div>
    </div>
  `;
}

async function viewReportDetails(id) {
  const report = await bugReportDB.getReportById(id);
  if (!report) return;
  
  const dialog = document.createElement('div');
  dialog.className = 'localizeai-dialog';
  dialog.innerHTML = `
    <div class="dialog-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
          <img src="${chrome.runtime.getURL('icons/lucide/bug.svg')}" width="24" height="24">
          ${i18n('bugReportDetails', report.id)}
        </h3>
        <button id="close-details" style="padding: 8px 16px; background: #e0e0e0; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <img src="${chrome.runtime.getURL('icons/lucide/x.svg')}" width="16" height="16">
          ${i18n('close')}
        </button>
      </div>
      
      <div style="background: #f8f9ff; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <h4 style="margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
          <img src="${chrome.runtime.getURL('icons/lucide/clipboard.svg')}" width="18" height="18">
          ${i18n('basicInfo')}
        </h4>
        <p style="margin: 5px 0;"><strong>ID:</strong> #${report.id}</p>
        <p style="margin: 5px 0;"><strong>Status:</strong> ${report.status}</p>
        <p style="margin: 5px 0;"><strong>Severity:</strong> ${report.severity}</p>
        <p style="margin: 5px 0;"><strong>Category:</strong> ${report.category}</p>
        <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
      </div>
      
      <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <h4 style="margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
          <img src="${chrome.runtime.getURL('icons/lucide/globe.svg')}" width="18" height="18">
          ${i18n('pageInfo')}
        </h4>
        <p style="margin: 5px 0;"><strong>Title:</strong> ${report.pageTitle}</p>
        <p style="margin: 5px 0; word-break: break-all;"><strong>URL:</strong> <a href="${report.url}" target="_blank" style="color: #667eea;">${report.url}</a></p>
        <p style="margin: 5px 0;"><strong>Viewport:</strong> ${report.viewport.width}x${report.viewport.height}</p>
      </div>
      
      <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <h4 style="margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
          <img src="${chrome.runtime.getURL('icons/lucide/target.svg')}" width="18" height="18">
          ${i18n('elementDetails')}
        </h4>
        <p style="margin: 5px 0;"><strong>Tag:</strong> &lt;${report.element.tag}&gt;</p>
        <p style="margin: 5px 0;"><strong>Text:</strong> ${report.element.text}</p>
        <p style="margin: 5px 0;"><strong>Selector:</strong> <code style="background: white; padding: 2px 6px; border-radius: 6px; font-size: 11px;">${report.element.selector}</code></p>
        <p style="margin: 5px 0;"><strong>XPath:</strong> <code style="background: white; padding: 2px 6px; border-radius: 6px; font-size: 11px;">${report.element.xpath}</code></p>
        <details style="margin-top: 10px;">
          <summary style="cursor: pointer; font-weight: 600;">${i18n('viewHTML')}</summary>
          <pre style="background: white; padding: 10px; border-radius: 8px; overflow-x: auto; font-size: 11px; margin-top: 10px;">${escapeHtml(report.element.html)}</pre>
        </details>
      </div>
      
      ${report.translation.translated ? `
        <div style="background: #cfe2ff; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <h4 style="margin: 0 0 10px 0;">${i18n('translationContext')}</h4>
          <p style="margin: 5px 0;"><strong>${i18n('sourceLanguage')}</strong> ${report.translation.sourceLang}</p>
          <p style="margin: 5px 0;"><strong>${i18n('targetLanguage')}</strong> ${report.translation.targetLang}</p>
          <div style="background: white; padding: 10px; border-radius: 8px; margin-top: 10px;">
            <p style="margin: 5px 0; color: #666;"><strong>Original:</strong> "${report.translation.original}"</p>
            <p style="margin: 5px 0; color: #28a745; font-weight: 600;"><strong>Translated:</strong> "${report.translation.translated}"</p>
          </div>
        </div>
      ` : ''}
      
      <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <h4 style="margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
          <img src="${chrome.runtime.getURL('icons/lucide/message-square.svg')}" width="18" height="18">
          ${i18n('issueDescription')}
        </h4>
        <p style="margin: 0; white-space: pre-wrap;">${report.notes}</p>
      </div>
      
      <div style="background: #e2e3e5; padding: 15px; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
          <img src="${chrome.runtime.getURL('icons/lucide/lightbulb.svg')}" width="18" height="18">
          ${i18n('suggestedSolutions')}
        </h4>
        ${generateSuggestions(report)}
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  document.getElementById('close-details').addEventListener('click', () => dialog.remove());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.remove();
  });
}

function generateSuggestions(report) {
  const suggestions = [];
  
  switch (report.category) {
    case 'translation':
      suggestions.push('• Review the translation with a native speaker');
      suggestions.push('• Check if the context was properly understood');
      suggestions.push('• Consider using a more natural/colloquial phrase');
      if (report.translation.translated) {
        suggestions.push(`• Try alternative: Use AI Suggestions feature to get better options`);
      }
      break;
      
    case 'overflow':
      suggestions.push('• Reduce text length by 20-30%');
      suggestions.push('• Use abbreviations where appropriate');
      suggestions.push('• Adjust CSS: increase container width or use text-overflow: ellipsis');
      suggestions.push('• Consider using a tooltip for full text');
      break;
      
    case 'layout':
      suggestions.push('• Check CSS flexbox/grid properties');
      suggestions.push('• Verify responsive breakpoints');
      suggestions.push('• Test with different text lengths');
      suggestions.push('• Review padding/margin values');
      break;
      
    case 'missing':
      suggestions.push('• Add translation key to localization files');
      suggestions.push('• Check if element is dynamically generated');
      suggestions.push('• Verify translation loading sequence');
      break;
      
    case 'formatting':
      suggestions.push('• Check HTML entities and special characters');
      suggestions.push('• Verify line breaks and spacing');
      suggestions.push('• Review font and typography settings');
      break;
      
    default:
      suggestions.push('• Document the issue clearly for the development team');
      suggestions.push('• Provide steps to reproduce');
      suggestions.push('• Include browser and device information');
  }
  
  return suggestions.map(s => `<p style="margin: 5px 0;">${s}</p>`).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function toggleReportStatus(id) {
  const report = await bugReportDB.getReportById(id);
  const newStatus = report.status === 'open' ? 'resolved' : 'open';
  
  await bugReportDB.updateReport(id, { status: newStatus });
  showNotification(i18n('reportMarkedAs', id, newStatus), 'check-circle');
  
  // Auto-sync to Drive
  await autoSyncToDrive();
  
  // Refresh manager if open
  const manager = document.getElementById('bug-report-manager');
  if (manager) {
    manager.remove();
    await showBugReportManager();
  }
  
  await updateBugReportStats();
}

async function deleteReport(id) {
  const confirmed = await showConfirmDialog(
    i18n('deleteReport'),
    i18n('deleteReportConfirm', id),
    i18n('delete'),
    i18n('cancel')
  );
  
  if (!confirmed) {
    return;
  }
  
  await bugReportDB.deleteReport(id);
  showNotification(i18n('reportDeleted', id), 'trash-2');
  
  // Auto-sync to Drive
  await autoSyncToDrive();
  
  // Refresh manager if open
  const manager = document.getElementById('bug-report-manager');
  if (manager) {
    manager.remove();
    await showBugReportManager();
  }
  
  await updateBugReportStats();
}

async function clearAllReports() {
  const confirmed = await showConfirmDialog(
    i18n('clearAllReports'),
    i18n('clearAllReportsConfirm'),
    i18n('deleteAll'),
    i18n('cancel'),
    true
  );
  
  if (!confirmed) {
    return;
  }
  
  await bugReportDB.clearAll();
  showNotification(i18n('allReportsCleared'), 'trash-2');
  
  // Sync to Drive
  await syncReportsToDrive();
  
  // Refresh manager
  const manager = document.getElementById('bug-report-manager');
  if (manager) {
    manager.remove();
    await showBugReportManager();
  }
  
  await updateBugReportStats();
}

// Sync reports to Google Drive
async function syncReportsToDrive() {
  try {
    const data = await chrome.storage.sync.get(['user', 'authToken']);
    
    if (!data.user || !data.authToken) {
      console.log('Not logged in, skipping Drive sync');
      return;
    }
    
    showNotification(i18n('syncingToGoogleDrive'), 'cloud-upload');
    
    const reports = await bugReportDB.getAllReports();
    await driveSyncService.syncToCloud(reports);
    
    showNotification(i18n('syncedToGoogleDrive'), 'check-circle');
  } catch (error) {
    console.error('Drive sync error:', error);
    showNotification(i18n('driveSyncFailed'), 'alert-triangle');
  }
}

// Sync reports from Google Drive
async function syncReportsFromDrive() {
  try {
    const data = await chrome.storage.sync.get(['user', 'authToken']);
    
    if (!data.user || !data.authToken) {
      showNotification(i18n('pleaseSignInToSync'), 'alert-triangle');
      return;
    }
    
    showNotification(i18n('syncingFromGoogleDrive'), 'cloud-download');
    
    const mergedReports = await driveSyncService.syncFromCloud();
    
    if (mergedReports && mergedReports.length > 0) {
      // Save merged reports to IndexedDB
      for (const report of mergedReports) {
        await bugReportDB.saveReport(report);
      }
      
      showNotification(i18n('syncedReportsFromDrive', mergedReports.length), 'check-circle');
      
      // Refresh manager if open
      const manager = document.getElementById('bug-report-manager');
      if (manager) {
        manager.remove();
        await showBugReportManager();
      }
    } else {
      showNotification(i18n('noReportsFoundInDrive'), 'info');
    }
  } catch (error) {
    console.error('Drive sync error:', error);
    showNotification(i18n('driveSyncFailed'), 'alert-triangle');
  }
}

// Auto-sync after report changes
async function autoSyncToDrive() {
  try {
    const data = await chrome.storage.sync.get(['user', 'authToken']);
    
    if (data.user && data.authToken) {
      const shouldSync = await driveSyncService.shouldSync();
      
      if (shouldSync) {
        await syncReportsToDrive();
      }
    }
  } catch (error) {
    console.error('Auto-sync error:', error);
  }
}

// Export functions will be in separate file
