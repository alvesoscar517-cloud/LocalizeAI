// Bug Report Export Functions
// Uses SheetJS (xlsx) library for Excel export

async function exportToExcel(reports) {
  try {
    showNotification(i18n('preparingExcelFile'), 'file-spreadsheet');
    
    // Check if XLSX library is loaded
    if (typeof XLSX === 'undefined') {
      console.error('XLSX library not loaded');
      showNotification(i18n('excelLibraryNotAvailable'), 'x-circle');
      return;
    }
    
    // Prepare data for Excel
    const data = reports.map(report => ({
      'ID': report.id || 'N/A',
      'Date': report.timestamp ? new Date(report.timestamp).toLocaleString() : 'N/A',
      'Status': report.status ? report.status.toUpperCase() : 'N/A',
      'Severity': report.severity ? report.severity.toUpperCase() : 'N/A',
      'Category': report.category || 'N/A',
      'Page Title': report.pageTitle || 'N/A',
      'URL': report.url || 'N/A',
      'Element Tag': report.element?.tag || 'N/A',
      'Element Text': report.element?.text || 'N/A',
      'Element Selector': report.element?.selector || 'N/A',
      'Original Text': report.translation?.original || 'N/A',
      'Translated Text': report.translation?.translated || 'N/A',
      'Source Language': report.translation?.sourceLang || 'N/A',
      'Target Language': report.translation?.targetLang || 'N/A',
      'Issue Description': report.notes || 'N/A',
      'Viewport': report.viewport ? `${report.viewport.width}x${report.viewport.height}` : 'N/A',
      'User Agent': report.userAgent || 'N/A'
    }));
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create main sheet
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 8 },  // ID
      { wch: 20 }, // Date
      { wch: 10 }, // Status
      { wch: 10 }, // Severity
      { wch: 15 }, // Category
      { wch: 30 }, // Page Title
      { wch: 50 }, // URL
      { wch: 12 }, // Element Tag
      { wch: 40 }, // Element Text
      { wch: 40 }, // Element Selector
      { wch: 40 }, // Original Text
      { wch: 40 }, // Translated Text
      { wch: 12 }, // Source Language
      { wch: 12 }, // Target Language
      { wch: 50 }, // Issue Description
      { wch: 15 }, // Viewport
      { wch: 30 }  // User Agent
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Bug Reports');
    
    // Create summary sheet
    const stats = await bugReportDB.getStats();
    const summaryData = [
      { Metric: 'Total Reports', Value: stats.total },
      { Metric: 'Open Issues', Value: stats.open },
      { Metric: 'Resolved Issues', Value: stats.resolved },
      { Metric: '', Value: '' },
      { Metric: 'High Severity', Value: stats.bySeverity.high },
      { Metric: 'Medium Severity', Value: stats.bySeverity.medium },
      { Metric: 'Low Severity', Value: stats.bySeverity.low },
      { Metric: '', Value: '' },
      ...Object.entries(stats.byCategory).map(([cat, count]) => ({
        Metric: `${cat} issues`,
        Value: count
      }))
    ];
    
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    
    // Generate filename
    const filename = `LocalizeAI_BugReports_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Save file
    XLSX.writeFile(wb, filename);
    
    showNotification(i18n('excelFileExported', filename), 'check-circle');
  } catch (error) {
    console.error('Excel export error:', error);
    showNotification(i18n('errorExportingToExcel'), 'x-circle');
  }
}

async function exportToJSON(reports) {
  try {
    const data = {
      exportDate: new Date().toISOString(),
      totalReports: reports.length,
      reports: reports
    };
    
    const json = JSON.stringify(data, null, 2);
    const filename = `LocalizeAI_BugReports_${new Date().toISOString().split('T')[0]}.json`;
    
    downloadFile(json, filename, 'application/json');
    showNotification(i18n('jsonFileExported', filename), 'check-circle');
  } catch (error) {
    console.error('JSON export error:', error);
    showNotification(i18n('errorExportingToJSON'), 'x-circle');
  }
}

async function exportToCSV(reports) {
  try {
    // CSV headers
    const headers = [
      'ID',
      'Date',
      'Status',
      'Severity',
      'Category',
      'Page Title',
      'URL',
      'Element Tag',
      'Element Text',
      'Element Selector',
      'Original Text',
      'Translated Text',
      'Source Language',
      'Target Language',
      'Issue Description',
      'Viewport',
      'User Agent'
    ];
    
    // CSV rows
    const rows = reports.map(report => [
      report.id,
      new Date(report.timestamp).toLocaleString(),
      report.status,
      report.severity,
      report.category,
      report.pageTitle || 'N/A',
      report.url,
      report.element.tag,
      report.element.text.replace(/"/g, '""'), // Escape quotes
      report.element.selector,
      (report.translation.original || 'N/A').replace(/"/g, '""'),
      (report.translation.translated || 'N/A').replace(/"/g, '""'),
      report.translation.sourceLang || 'N/A',
      report.translation.targetLang || 'N/A',
      report.notes.replace(/"/g, '""'),
      `${report.viewport.width}x${report.viewport.height}`,
      report.userAgent
    ]);
    
    // Build CSV content
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const filename = `LocalizeAI_BugReports_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadFile(csvContent, filename, 'text/csv');
    showNotification(i18n('csvFileExported', filename), 'check-circle');
  } catch (error) {
    console.error('CSV export error:', error);
    showNotification(i18n('errorExportingToCSV'), 'x-circle');
  }
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



// Export to Jira (future feature)
async function exportToJira(reports) {
  showNotification('🚧 Jira integration coming soon!');
  // TODO: Implement Jira API integration
}

// Export to GitHub Issues (future feature)
async function exportToGitHub(reports) {
  showNotification('🚧 GitHub integration coming soon!');
  // TODO: Implement GitHub API integration
}
