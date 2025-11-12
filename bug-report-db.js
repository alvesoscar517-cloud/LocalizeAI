// IndexedDB Manager for Bug Reports
if (typeof window.BugReportDB === 'undefined') {
window.BugReportDB = class BugReportDB {
  constructor() {
    this.dbName = 'LocalizeAI_BugReports';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create bug reports store
        if (!db.objectStoreNames.contains('reports')) {
          const store = db.createObjectStore('reports', { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('url', 'url', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('severity', 'severity', { unique: false });
          store.createIndex('category', 'category', { unique: false });
        }
      };
    });
  }

  async addReport(report) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['reports'], 'readwrite');
      const store = transaction.objectStore('reports');
      
      const reportData = {
        ...report,
        timestamp: Date.now(),
        status: 'open'
      };

      const request = store.add(reportData);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllReports() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['reports'], 'readonly');
      const store = transaction.objectStore('reports');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getReportById(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['reports'], 'readonly');
      const store = transaction.objectStore('reports');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateReport(id, updates) {
    if (!this.db) await this.init();

    return new Promise(async (resolve, reject) => {
      const report = await this.getReportById(id);
      if (!report) {
        reject(new Error('Report not found'));
        return;
      }

      const transaction = this.db.transaction(['reports'], 'readwrite');
      const store = transaction.objectStore('reports');
      
      const updatedReport = { ...report, ...updates };
      const request = store.put(updatedReport);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteReport(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['reports'], 'readwrite');
      const store = transaction.objectStore('reports');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getReportsByStatus(status) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['reports'], 'readonly');
      const store = transaction.objectStore('reports');
      const index = store.index('status');
      const request = index.getAll(status);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getStats() {
    const reports = await this.getAllReports();
    
    return {
      total: reports.length,
      open: reports.filter(r => r.status === 'open').length,
      resolved: reports.filter(r => r.status === 'resolved').length,
      bySeverity: {
        high: reports.filter(r => r.severity === 'high').length,
        medium: reports.filter(r => r.severity === 'medium').length,
        low: reports.filter(r => r.severity === 'low').length
      },
      byCategory: reports.reduce((acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
      }, {})
    };
  }

  async clearAll() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['reports'], 'readwrite');
      const store = transaction.objectStore('reports');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

};

// Export singleton instance
if (typeof window.bugReportDB === 'undefined') {
  window.bugReportDB = new window.BugReportDB();
}
var bugReportDB = window.bugReportDB;
