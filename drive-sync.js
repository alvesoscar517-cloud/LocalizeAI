// Google Drive Sync Service for Bug Reports
if (typeof window.DRIVE_API_BASE === 'undefined') {
window.DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
window.DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

window.DriveSyncService = class DriveSyncService {
  constructor() {
    this.token = null;
    this.folderId = null;
    this.syncInProgress = false;
  }

  // Initialize with auth token
  async init() {
    const data = await chrome.storage.sync.get(['authToken']);
    this.token = data.authToken;
    
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    // Get or create app folder
    await this.ensureAppFolder();
  }

  // Ensure LocalizeAI folder exists in Drive
  async ensureAppFolder() {
    try {
      // Search for existing folder
      const searchResponse = await fetch(
        `${DRIVE_API_BASE}/files?q=name='LocalizeAI_Reports' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        }
      );

      const searchData = await searchResponse.json();

      if (searchData.files && searchData.files.length > 0) {
        this.folderId = searchData.files[0].id;
      } else {
        // Create new folder
        const createResponse = await fetch(`${DRIVE_API_BASE}/files`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'LocalizeAI_Reports',
            mimeType: 'application/vnd.google-apps.folder'
          })
        });

        const createData = await createResponse.json();
        this.folderId = createData.id;
      }
    } catch (error) {
      console.error('Error ensuring app folder:', error);
      throw error;
    }
  }

  // Upload bug reports to Drive
  async uploadReports(reports) {
    if (!this.token || !this.folderId) {
      await this.init();
    }

    try {
      const fileName = `bug_reports_${Date.now()}.json`;
      const fileContent = JSON.stringify(reports, null, 2);

      // Create metadata
      const metadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [this.folderId],
        description: `LocalizeAI bug reports backup - ${new Date().toISOString()}`
      };

      // Upload file
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([fileContent], { type: 'application/json' }));

      const response = await fetch(
        `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`
          },
          body: form
        }
      );

      const data = await response.json();

      // Save file ID for future updates
      await chrome.storage.local.set({
        lastDriveFileId: data.id,
        lastDriveSync: Date.now()
      });

      return data;
    } catch (error) {
      console.error('Error uploading to Drive:', error);
      throw error;
    }
  }

  // Download bug reports from Drive
  async downloadReports() {
    if (!this.token || !this.folderId) {
      await this.init();
    }

    try {
      // Get latest file from folder
      const response = await fetch(
        `${DRIVE_API_BASE}/files?q='${this.folderId}' in parents and mimeType='application/json' and trashed=false&orderBy=createdTime desc&pageSize=1`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        }
      );

      const data = await response.json();

      if (!data.files || data.files.length === 0) {
        return null;
      }

      const fileId = data.files[0].id;

      // Download file content
      const contentResponse = await fetch(
        `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        }
      );

      const reports = await contentResponse.json();

      return reports;
    } catch (error) {
      console.error('Error downloading from Drive:', error);
      throw error;
    }
  }

  // Sync: Upload local reports to Drive
  async syncToCloud(reports) {
    if (this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;

    try {
      await this.uploadReports(reports);
    } catch (error) {
      console.error('Sync to Drive failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync: Download from Drive and merge with local
  async syncFromCloud() {
    if (this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;

    try {
      const cloudReports = await this.downloadReports();

      if (!cloudReports) {
        return [];
      }

      // Get local reports from IndexedDB
      const localReports = await this.getLocalReports();

      // Merge reports (cloud takes precedence for conflicts)
      const merged = this.mergeReports(localReports, cloudReports);

      return merged;
    } catch (error) {
      console.error('Sync from Drive failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Get local reports from IndexedDB
  async getLocalReports() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('LocalizeAI_BugReports', 1);

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['reports'], 'readonly');
        const store = transaction.objectStore('reports');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          resolve(getAllRequest.result || []);
        };

        getAllRequest.onerror = () => {
          reject(getAllRequest.error);
        };
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Merge local and cloud reports
  mergeReports(localReports, cloudReports) {
    const merged = new Map();

    // Add local reports
    localReports.forEach(report => {
      merged.set(report.id, report);
    });

    // Add/update with cloud reports (cloud takes precedence)
    cloudReports.forEach(report => {
      const existing = merged.get(report.id);
      
      if (!existing || new Date(report.updatedAt) > new Date(existing.updatedAt)) {
        merged.set(report.id, report);
      }
    });

    return Array.from(merged.values());
  }

  // Auto-sync: Upload after changes
  async autoSync() {
    try {
      const reports = await this.getLocalReports();
      await this.syncToCloud(reports);
    } catch (error) {
      console.error('Auto-sync failed:', error);
    }
  }

  // Check if sync is needed
  async shouldSync() {
    const data = await chrome.storage.local.get(['lastDriveSync']);
    const lastSync = data.lastDriveSync || 0;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    return (now - lastSync) > fiveMinutes;
  }
}

};

// Export singleton instance
if (typeof window.driveSyncService === 'undefined') {
  window.driveSyncService = new window.DriveSyncService();
}
var driveSyncService = window.driveSyncService;
var DRIVE_API_BASE = window.DRIVE_API_BASE;
var DRIVE_UPLOAD_BASE = window.DRIVE_UPLOAD_BASE;
