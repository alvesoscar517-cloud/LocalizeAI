// JSON File Translator Feature
// Allows translating JSON language files to multiple languages
// Supports both Google Translate and High-Quality AI translation

class JSONTranslator {
  constructor() {
    this.sourceFile = null;
    this.sourceData = null;
    this.targetLanguages = [];
    this.translationMode = null; // 'google' or 'ai' - user must select
    this.results = new Map();
  }

  // Show JSON translator dialog
  showDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'localizeai-dialog';
    dialog.id = 'json-translator-dialog';
    dialog.innerHTML = `
      <div class="dialog-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none;">
        <style>
          .dialog-content::-webkit-scrollbar {
            width: 0;
            display: none;
          }
        </style>
        <h4 style="display: flex; align-items: center; gap: 8px;">
          <img src="${chrome.runtime.getURL('icons/lucide/file-json.svg')}" width="20" height="20">
          JSON File Translator
        </h4>
        <p style="font-size: 13px; color: #666; margin-bottom: 20px;">
          Translate JSON language files to multiple languages with Google Translate or AI
        </p>

        <!-- Step 1: Upload File -->
        <div class="translator-step" id="step-upload">
          <h5 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <span style="background: #667eea; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px;">1</span>
            ${i18n('uploadJSONFile')}
          </h5>
          <div style="border: 2px dashed #667eea; border-radius: 8px; padding: 40px 30px; text-align: center; background: #f8f9ff; cursor: pointer; transition: all 0.3s;" id="file-drop-zone">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <img src="${chrome.runtime.getURL('icons/lucide/upload.svg')}" width="48" height="48" style="opacity: 0.6; margin-bottom: 16px; filter: invert(40%) sepia(85%) saturate(1500%) hue-rotate(220deg);">
              <p style="font-size: 15px; color: #667eea; font-weight: 600; margin-bottom: 8px;">${i18n('dropJSONFileHere')}</p>
              <p style="font-size: 12px; color: #999;">${i18n('supportsJSONFiles')}</p>
            </div>
            <input type="file" id="json-file-input" accept=".json" style="display: none;">
          </div>
          <div id="file-preview" style="display: none; margin-top: 12px; padding: 12px; background: #f8f9fa; border-radius: 10px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <img src="${chrome.runtime.getURL('icons/lucide/file-text.svg')}" width="16" height="16">
              <strong id="file-name">filename.json</strong>
              <span id="file-size" style="color: #999; font-size: 12px;">0 KB</span>
            </div>
            <div style="font-size: 12px; color: #666;">
              <span id="keys-count">0</span> translation keys found
            </div>
            <pre id="file-content-preview" style="max-height: 150px; overflow-y: auto; background: white; padding: 10px; border-radius: 8px; font-size: 11px; margin-top: 8px;"></pre>
          </div>
        </div>

        <!-- Step 2: Select Target Languages -->
        <div class="translator-step" id="step-languages" style="margin-top: 20px; opacity: 0.5; pointer-events: none;">
          <h5 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
            <span style="display: flex; align-items: center; gap: 8px;">
              <span style="background: #667eea; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px;">2</span>
              ${i18n('selectTargetLanguages')}
            </span>
            <span id="selected-count" style="font-size: 12px; color: #667eea; font-weight: 500;">0 selected</span>
          </h5>
          ${this.getLanguageCheckboxes()}
          <div style="margin-top: 12px; padding: 10px; background: #fff3cd; border-radius: 10px; font-size: 12px; color: #856404; display: flex; align-items: center; gap: 6px;">
            <img src="${chrome.runtime.getURL('icons/lucide/info.svg')}" width="14" height="14" style="flex-shrink: 0;">
            <span>${i18n('selectOneOrMore')}</span>
          </div>
        </div>

        <!-- Step 3: Choose Translation Mode -->
        <div class="translator-step" id="step-mode" style="margin-top: 20px; opacity: 0.5; pointer-events: none;">
          <h5 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <span style="background: #667eea; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px;">3</span>
            ${i18n('chooseTranslationMode')}
          </h5>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="translation-mode-card" data-mode="google" style="border: 2px solid #ddd; border-radius: 8px; padding: 16px; cursor: pointer; background: white; transition: all 0.2s;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <img src="${chrome.runtime.getURL('icons/lucide/globe.svg')}" width="20" height="20">
                <strong>${i18n('googleTranslate')}</strong>
                <span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 8px; font-size: 10px; font-weight: 600;">${i18n('free').toUpperCase()}</span>
              </div>
              <p style="font-size: 12px; color: #666; margin-bottom: 8px;">${i18n('fastAndFreeTranslation')}</p>
              <div style="font-size: 11px; color: #28a745;">
                ✓ ${i18n('free')}<br>
                ✓ ${i18n('fast')}<br>
                ✓ 100+ ${i18n('languages')}
              </div>
            </div>
            <div class="translation-mode-card" data-mode="ai" style="border: 2px solid #ddd; border-radius: 8px; padding: 16px; cursor: pointer; background: white; transition: all 0.2s;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <img src="${chrome.runtime.getURL('icons/lucide/sparkles.svg')}" width="20" height="20">
                <strong>${i18n('aiTranslation')}</strong>
                <span style="background: #ffc107; color: #000; padding: 2px 6px; border-radius: 8px; font-size: 10px; font-weight: 600;">${i18n('premium').toUpperCase()}</span>
              </div>
              <p style="font-size: 12px; color: #666; margin-bottom: 8px;">${i18n('highQualityTranslation')}</p>
              <div style="font-size: 11px; color: #007bff;">
                ✓ ${i18n('contextAware')}<br>
                ✓ ${i18n('naturalPhrasing')}<br>
                ✓ ${i18n('betterForUIText')}
              </div>
              <div style="margin-top: 8px; padding: 6px; background: #e8f4fd; border-radius: 4px; font-size: 10px; color: #004085; display: flex; align-items: center; gap: 4px;">
                <img src="${chrome.runtime.getURL('icons/lucide/info.svg')}" width="12" height="12" style="flex-shrink: 0; opacity: 0.8;">
                <span>${i18n('aiLimitInfo')}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: Translate -->
        <div class="translator-step" id="step-translate" style="margin-top: 20px; opacity: 0.5; pointer-events: none;">
          <button id="start-translation-btn" style="width: 100%; padding: 14px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <img src="${chrome.runtime.getURL('icons/lucide/play.svg')}" width="18" height="18" style="filter: brightness(0) invert(1);">
            ${i18n('startTranslation')}
          </button>
        </div>

        <!-- Progress -->
        <div id="translation-progress" style="display: none; margin-top: 20px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="spinner" style="width: 16px; height: 16px; border: 2px solid #667eea; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <strong>${i18n('translating')}</strong>
            </div>
            <div id="progress-percentage" style="font-size: 18px; font-weight: 700; color: #667eea;">0%</div>
          </div>
          <div style="background: #e9ecef; border-radius: 8px; height: 10px; overflow: hidden; margin-bottom: 12px;">
            <div id="progress-bar" style="background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); height: 100%; width: 0%; transition: width 0.3s;"></div>
          </div>
          <div id="progress-text" style="font-size: 12px; color: #666; margin-bottom: 8px;">Preparing...</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #dee2e6;">
            <div style="text-align: center;">
              <div style="font-size: 11px; color: #999; margin-bottom: 4px;">Current Language</div>
              <div id="current-lang" style="font-size: 13px; font-weight: 600; color: #667eea;">-</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 11px; color: #999; margin-bottom: 4px;">Keys Translated</div>
              <div id="keys-progress" style="font-size: 13px; font-weight: 600; color: #28a745;">0 / 0</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 11px; color: #999; margin-bottom: 4px;">Time Elapsed</div>
              <div id="time-elapsed" style="font-size: 13px; font-weight: 600; color: #6c757d;">0s</div>
            </div>
          </div>
        </div>

        <!-- Results -->
        <div id="translation-results" style="display: none; margin-top: 20px;">
          <h5 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <img src="${chrome.runtime.getURL('icons/lucide/check-circle.svg')}" width="20" height="20" style="color: #28a745;">
            ${i18n('translationComplete')}
          </h5>
          <div id="results-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
          <div style="display: flex; gap: 10px; margin-top: 16px;">
            <button id="download-all-btn" style="flex: 1; padding: 12px; background: #28a745; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <img src="${chrome.runtime.getURL('icons/lucide/download.svg')}" width="16" height="16" style="filter: brightness(0) invert(1); flex-shrink: 0;">
              <span>${i18n('downloadAll')}</span>
            </button>
            <button id="translate-another-btn" style="flex: 1; padding: 12px; background: #667eea; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <img src="${chrome.runtime.getURL('icons/lucide/refresh-cw.svg')}" width="16" height="16" style="filter: brightness(0) invert(1); flex-shrink: 0;">
              <span>${i18n('translateAnotherFile')}</span>
            </button>
          </div>
        </div>

        <!-- Close Button -->
        <button id="close-json-translator" style="width: 100%; padding: 10px; background: #e0e0e0; color: #333; border: none; border-radius: 10px; cursor: pointer; margin-top: 20px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500;">
          ${i18n('close')}
        </button>
      </div>
    `;

    document.body.appendChild(dialog);
    this.attachEventListeners();

    // Add animations and styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      #file-drop-zone:hover {
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
      }
      
      .translator-step {
        transition: opacity 0.3s ease, transform 0.3s ease;
      }
      
      .translator-step[style*="opacity: 1"] {
        animation: slideIn 0.4s ease;
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }

  getLanguageCheckboxes() {
    // Use global language config if available
    if (typeof LanguageHelper !== 'undefined') {
      const allLangs = LanguageHelper.getAllLanguageCodes();
      
      let html = '<div style="background: white; border: 1px solid #e0e0e0; border-radius: 10px; padding: 12px;">';
      html += `<input type="text" id="json-lang-search" placeholder="" style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 13px; margin-bottom: 12px; transition: border-color 0.2s;">`;
      
      // Container with hidden scrollbar - ALL LANGUAGES
      html += '<div id="json-lang-checkboxes-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; max-height: 350px; overflow-y: auto; padding: 4px; scrollbar-width: none; -ms-overflow-style: none;">';
      
      // All languages sorted alphabetically
      allLangs
        .sort((a, b) => {
          const nameA = LanguageHelper.getLanguageName(a, false);
          const nameB = LanguageHelper.getLanguageName(b, false);
          return nameA.localeCompare(nameB);
        })
        .forEach(code => {
          const name = LanguageHelper.getLanguageName(code, true);
          html += `
            <label class="json-lang-checkbox-label" data-lang-code="${code}" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: white; border: 1.5px solid #e0e0e0; border-radius: 10px; cursor: pointer; transition: all 0.2s;">
              <input type="checkbox" class="json-lang-checkbox" value="${code}" style="width: 16px; height: 16px; cursor: pointer; accent-color: #667eea;">
              <span style="font-size: 12px; line-height: 1.3;">${name}</span>
            </label>
          `;
        });
      
      html += '</div></div>';
      
      // Add hidden scrollbar styles
      html += `
        <style>
          #json-lang-checkboxes-container::-webkit-scrollbar {
            width: 0;
            display: none;
          }
          .json-lang-checkbox-label:hover {
            border-color: #667eea !important;
            background: #f8f9ff !important;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(102, 126, 234, 0.1);
          }
          .json-lang-checkbox-label:has(input:checked) {
            border-color: #667eea !important;
            background: #e8e9ff !important;
            box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
          }
          #json-lang-search:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
        </style>
      `;
      
      return html;
    }
    
    // Fallback to basic list if LanguageHelper not available
    const languages = [
      { code: 'vi', name: 'Tiếng Việt' },
      { code: 'en', name: 'English' },
      { code: 'ja', name: '日本語' },
      { code: 'ko', name: '한국어' },
      { code: 'zh', name: '中文' },
      { code: 'zh-TW', name: '繁體中文' },
      { code: 'th', name: 'ไทย' },
      { code: 'id', name: 'Bahasa Indonesia' },
      { code: 'es', name: 'Español' },
      { code: 'fr', name: 'Français' },
      { code: 'de', name: 'Deutsch' },
      { code: 'pt', name: 'Português' },
      { code: 'ru', name: 'Русский' },
      { code: 'ar', name: 'العربية' },
      { code: 'hi', name: 'हिन्दी' },
      { code: 'it', name: 'Italiano' }
    ];

    return languages.map(lang => `
      <label style="display: flex; align-items: center; gap: 8px; padding: 10px; background: white; border: 1px solid #ddd; border-radius: 10px; cursor: pointer; transition: all 0.2s;">
        <input type="checkbox" class="lang-checkbox" value="${lang.code}" style="width: 16px; height: 16px; cursor: pointer;">
        <span style="font-size: 13px;">${lang.name}</span>
      </label>
    `).join('');
  }

  attachEventListeners() {
    // File upload
    const dropZone = document.getElementById('file-drop-zone');
    const fileInput = document.getElementById('json-file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#5568d3';
      dropZone.style.borderWidth = '3px';
      dropZone.style.background = '#e8e9ff';
      dropZone.style.transform = 'scale(1.02)';
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = '#667eea';
      dropZone.style.borderWidth = '2px';
      dropZone.style.background = '#f8f9ff';
      dropZone.style.transform = 'scale(1)';
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#667eea';
      dropZone.style.borderWidth = '2px';
      dropZone.style.background = '#f8f9ff';
      dropZone.style.transform = 'scale(1)';
      
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.json')) {
        this.handleFileUpload(file);
      } else {
        showNotification(i18n('pleaseUploadValidJSON'), 'alert-triangle');
      }
    });
    
    // Add hover effect
    dropZone.addEventListener('mouseenter', () => {
      if (!this.sourceFile) {
        dropZone.style.borderColor = '#5568d3';
        dropZone.style.background = '#e8e9ff';
      }
    });
    
    dropZone.addEventListener('mouseleave', () => {
      if (!this.sourceFile) {
        dropZone.style.borderColor = '#667eea';
        dropZone.style.background = '#f8f9ff';
      }
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleFileUpload(file);
      }
    });

    // Language selection (use unique class names to avoid conflicts)
    document.querySelectorAll('.json-lang-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.updateTargetLanguages();
      });
    });
    
    // Language search
    const langSearch = document.getElementById('json-lang-search');
    if (langSearch) {
      langSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.json-lang-checkbox-label').forEach(label => {
          const langCode = label.dataset.langCode;
          const text = label.textContent.toLowerCase();
          
          if (text.includes(query) || langCode.includes(query)) {
            label.style.display = 'flex';
          } else {
            label.style.display = 'none';
          }
        });
      });
    }
    
    // Removed bulk selection buttons for cleaner UI

    // Translation mode selection
    document.querySelectorAll('.translation-mode-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.translation-mode-card').forEach(c => {
          c.style.borderColor = '#ddd';
          c.style.background = 'white';
        });
        card.style.borderColor = '#667eea';
        card.style.background = '#f8f9ff';
        this.translationMode = card.dataset.mode;
        this.enableStep('step-translate');
      });
    });

    // Start translation
    document.getElementById('start-translation-btn').addEventListener('click', () => {
      this.startTranslation();
    });

    // Download all
    document.getElementById('download-all-btn')?.addEventListener('click', () => {
      this.downloadAll();
    });

    // Translate another
    document.getElementById('translate-another-btn')?.addEventListener('click', () => {
      this.reset();
    });

    // Close
    document.getElementById('close-json-translator').addEventListener('click', () => {
      document.getElementById('json-translator-dialog').remove();
    });

    // Close on overlay click
    document.getElementById('json-translator-dialog').addEventListener('click', (e) => {
      if (e.target.id === 'json-translator-dialog') {
        e.target.remove();
      }
    });
  }

  async handleFileUpload(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      this.sourceFile = file;
      this.sourceData = data;

      // Hide drop zone
      const dropZone = document.getElementById('file-drop-zone');
      if (dropZone) {
        dropZone.style.display = 'none';
      }

      // Show preview
      const preview = document.getElementById('file-preview');
      const keysCount = this.countKeys(data);
      
      document.getElementById('file-name').textContent = file.name;
      document.getElementById('file-size').textContent = i18n('kbSize', (file.size / 1024).toFixed(1));
      document.getElementById('keys-count').textContent = keysCount;
      document.getElementById('file-content-preview').textContent = JSON.stringify(data, null, 2).substring(0, 500) + '...';
      
      preview.style.display = 'block';
      
      // Enable next step
      this.enableStep('step-languages');
      
      showNotification(i18n('loadedTranslationKeys', keysCount), 'check-circle');
    } catch (error) {
      showNotification(i18n('invalidJSONFile'), 'x-circle');
      console.error('JSON parse error:', error);
    }
  }

  countKeys(obj, count = 0) {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        count = this.countKeys(obj[key], count);
      } else {
        count++;
      }
    }
    return count;
  }

  async updateTargetLanguages() {
    const MAX_LANGUAGES = 20; // Max for all users
    const FREE_USER_LIMIT = 1; // ✅ Free users can only select 1 language at a time
    
    const checkedBoxes = Array.from(document.querySelectorAll('.json-lang-checkbox:checked'));
    
    // ✅ Check if user is premium
    const { user } = await chrome.storage.sync.get(['user']);
    const isPremium = user?.isPremium || false;
    
    // ✅ Enforce limit based on user type
    const limit = isPremium ? MAX_LANGUAGES : FREE_USER_LIMIT;
    
    if (checkedBoxes.length > limit) {
      // Uncheck the last one
      const lastChecked = checkedBoxes[checkedBoxes.length - 1];
      lastChecked.checked = false;
      
      if (!isPremium && checkedBoxes.length > FREE_USER_LIMIT) {
        // Show upgrade dialog for free users
        showNotification(
          i18n('jsonMultiLanguageRequiresPremium'),
          'crown',
          5000
        );
        setTimeout(() => showUpgradeDialog(), 500);
      } else {
        // Show max limit notification
        showNotification(
          i18n('maxLanguagesReached', limit),
          'alert-circle',
          4000
        );
      }
      
      // Update with corrected selection
      this.targetLanguages = Array.from(document.querySelectorAll('.json-lang-checkbox:checked'))
        .map(cb => cb.value);
    } else {
      this.targetLanguages = checkedBoxes.map(cb => cb.value);
    }
    
    // Update selected count with warning color if approaching limit
    const countEl = document.getElementById('selected-count');
    if (countEl) {
      // ✅ Show different message for free vs premium
      if (isPremium) {
        countEl.textContent = i18n('languageCountWithMax', this.targetLanguages.length, MAX_LANGUAGES);
      } else {
        countEl.textContent = `${this.targetLanguages.length} / ${FREE_USER_LIMIT} ${i18n('selected')} (${i18n('freeLabel')})`;
      }
      
      if (this.targetLanguages.length >= limit) {
        countEl.style.color = '#f59e0b'; // Orange warning
      } else if (this.targetLanguages.length > 0) {
        countEl.style.color = '#28a745'; // Green
      } else {
        countEl.style.color = '#667eea'; // Blue
      }
    }
    
    if (this.targetLanguages.length > 0) {
      this.enableStep('step-mode');
    } else {
      this.disableStep('step-mode');
      this.disableStep('step-translate');
    }
  }

  enableStep(stepId) {
    const step = document.getElementById(stepId);
    step.style.opacity = '1';
    step.style.pointerEvents = 'auto';
  }

  disableStep(stepId) {
    const step = document.getElementById(stepId);
    step.style.opacity = '0.5';
    step.style.pointerEvents = 'none';
  }

  async startTranslation() {
    if (!this.sourceData || this.targetLanguages.length === 0) {
      showNotification(i18n('pleaseCompleteAllSteps'), 'alert-triangle');
      return;
    }

    // ✅ Check requirements based on mode
    if (this.translationMode === 'ai') {
      // AI mode requires Premium subscription
      const { apiKey, user } = await chrome.storage.sync.get(['apiKey', 'user']);
      
      if (!apiKey || !user) {
        showNotification(i18n('pleaseSignInForAI'), 'alert-triangle', 5000);
        return;
      }
      
      if (!user.isPremium) {
        showNotification(i18n('aiTranslationRequiresPremium'), 'crown', 5000);
        setTimeout(() => showUpgradeDialog(), 500);
        return;
      }
      
      // ⚠️ AI mode limits to avoid quota exhaustion
      // Gemini 2.0 Flash Exp: 10 req/min, 1000 req/day
      const AI_MAX_LANGUAGES = 5; // Max 5 languages at once (reasonable for most use cases)
      
      // Calculate estimated requests
      const estimatedRequests = Math.ceil(this.totalKeys / 10) * this.targetLanguages.length;
      const MAX_REQUESTS_PER_TRANSLATION = 100; // Max 100 API calls per translation
      
      if (estimatedRequests > MAX_REQUESTS_PER_TRANSLATION) {
        const maxKeys = Math.floor(MAX_REQUESTS_PER_TRANSLATION / this.targetLanguages.length) * 10;
        showNotification(
          i18n('aiTooManyRequests', this.totalKeys, this.targetLanguages.length, maxKeys),
          'alert-triangle',
          8000
        );
        return;
      }
      
      if (this.targetLanguages.length > AI_MAX_LANGUAGES) {
        showNotification(
          i18n('aiMaxLanguagesExceeded', AI_MAX_LANGUAGES),
          'alert-triangle',
          6000
        );
        return;
      }
      
      // Show warning if close to limit
      if (estimatedRequests > 50) {
        showNotification(
          i18n('aiLargeTranslationWarning', estimatedRequests),
          'alert-circle',
          5000
        );
      }
    }

    // Show progress
    document.getElementById('translation-progress').style.display = 'block';
    document.getElementById('step-translate').style.display = 'none';

    this.results.clear();
    this.startTime = Date.now();
    this.completedLanguages = 0;
    
    // Start timer
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      document.getElementById('time-elapsed').textContent = i18n('timeElapsed', elapsed);
    }, 1000);
    
    // Count total keys for progress
    this.totalKeys = this.countKeys(this.sourceData);
    
    const totalLangs = this.targetLanguages.length;
    
    // Estimate time per language (Google Translate only)
    const estimatedTimePerLang = Math.ceil(this.totalKeys * 0.05); // Google: ~0.05s per key
    
    // Start progress simulation
    this.startProgressSimulation(totalLangs, estimatedTimePerLang);
    
    // Update initial progress
    this.updateProgress(0, totalLangs, i18n('startingTranslation', totalLangs));
    document.getElementById('current-lang').textContent = i18n('preparing');
    document.getElementById('keys-progress').textContent = `0 / ${this.totalKeys}`;

    try {
      // 🚀 PARALLEL PROCESSING: Translate all languages simultaneously
      const translationPromises = this.targetLanguages.map(async (targetLang, index) => {
        try {
          const langName = typeof LanguageHelper !== 'undefined' 
            ? LanguageHelper.getLanguageName(targetLang, false)
            : targetLang;
          
          // Update current language display
          this.updateCurrentLanguage(langName, index + 1, totalLangs);
          
          // Use new optimized endpoint
          const translated = await this.translateWithBackend(this.sourceData, targetLang, apiKey);
          
          // Update completed count
          this.completedLanguages++;
          this.updateRealProgress();
          
          return { lang: targetLang, data: translated, success: true };
        } catch (error) {
          console.error(`Translation error for ${targetLang}:`, error);
          this.completedLanguages++;
          return { lang: targetLang, error, success: false };
        }
      });

      // Wait for all translations to complete
      const results = await Promise.all(translationPromises);
      
      // Stop progress simulation
      this.stopProgressSimulation();
      
      // Check if any result has auth error
      const authError = results.find(r => !r.success && r.error?.message === 'Authentication required');
      const upgradeError = results.find(r => !r.success && r.error?.message === 'Usage limit reached');
      
      if (authError) {
        clearInterval(this.timerInterval);
        document.getElementById('translation-progress').style.display = 'none';
        document.getElementById('step-translate').style.display = 'block';
        return;
      }
      
      if (upgradeError) {
        clearInterval(this.timerInterval);
        document.getElementById('translation-progress').style.display = 'none';
        document.getElementById('step-translate').style.display = 'block';
        return;
      }
      
      // Process results
      let successCount = 0;
      results.forEach(result => {
        if (result.success) {
          this.results.set(result.lang, result.data);
          successCount++;
        } else {
          showNotification(i18n('failedToTranslateTo', result.lang), 'x-circle');
        }
      });

      // Update final progress
      document.getElementById('current-lang').textContent = i18n('complete');
      document.getElementById('keys-progress').textContent = `${this.totalKeys} / ${this.totalKeys}`;
      this.updateProgress(100, 100, i18n('completedLanguages', successCount, totalLangs));

      // Stop timer
      clearInterval(this.timerInterval);

      // Show results
      if (successCount > 0) {
        this.showResults();
      } else {
        showNotification(i18n('allTranslationsFailed'), 'x-circle');
      }
    } catch (error) {
      console.error('Translation process error:', error);
      this.stopProgressSimulation();
      clearInterval(this.timerInterval);
      showNotification(i18n('translationFailed'), 'x-circle');
    }
  }

  // Simulate progress based on estimated time
  startProgressSimulation(totalLangs, estimatedTimePerLang) {
    this.simulatedProgress = 0;
    const totalEstimatedTime = totalLangs * estimatedTimePerLang;
    const updateInterval = 200; // Update every 200ms
    const incrementPerUpdate = (100 / (totalEstimatedTime * 1000 / updateInterval)) * 0.8; // Only go to 80% via simulation
    
    this.progressSimulationInterval = setInterval(() => {
      // Don't exceed 80% via simulation (real progress will take over)
      if (this.simulatedProgress < 80) {
        this.simulatedProgress += incrementPerUpdate;
        
        // Use the higher of simulated or real progress
        const realProgress = (this.completedLanguages / totalLangs) * 100;
        const displayProgress = Math.max(this.simulatedProgress, realProgress);
        
        this.updateProgressBar(displayProgress);
      }
    }, updateInterval);
  }

  stopProgressSimulation() {
    if (this.progressSimulationInterval) {
      clearInterval(this.progressSimulationInterval);
      this.progressSimulationInterval = null;
    }
  }

  updateCurrentLanguage(langName, current, total) {
    const currentLangEl = document.getElementById('current-lang');
    if (currentLangEl) {
      currentLangEl.textContent = `${langName} (${current}/${total})`;
    }
  }

  updateRealProgress() {
    const totalLangs = this.targetLanguages.length;
    const realProgress = (this.completedLanguages / totalLangs) * 100;
    
    // Update progress bar to real progress if it's higher than simulated
    if (realProgress > this.simulatedProgress) {
      this.updateProgressBar(realProgress);
    }
    
    // Update keys progress (estimate based on completed languages)
    const estimatedKeysCompleted = Math.floor((this.completedLanguages / totalLangs) * this.totalKeys);
    document.getElementById('keys-progress').textContent = `${estimatedKeysCompleted} / ${this.totalKeys}`;
  }

  updateProgressBar(percent) {
    const roundedPercent = Math.min(Math.round(percent), 100);
    document.getElementById('progress-bar').style.width = `${roundedPercent}%`;
    document.getElementById('progress-percentage').textContent = `${roundedPercent}%`;
  }

  async translateWithBackend(jsonData, targetLang, apiKey = null) {
    // ✅ NO BACKEND NEEDED - Use free client-side translation
    // This method now uses the same client-side translation as translateObject
    return await this.translateObject(jsonData, targetLang);
  }

  async translateObject(obj, targetLang, sourceLang = 'en') {
    // Collect all strings first for batch processing
    const strings = [];
    const paths = [];
    
    const collectStrings = (o, path = []) => {
      for (const key in o) {
        const currentPath = [...path, key];
        if (typeof o[key] === 'object' && o[key] !== null) {
          collectStrings(o[key], currentPath);
        } else if (typeof o[key] === 'string') {
          strings.push(o[key]);
          paths.push(currentPath);
        }
      }
    };
    
    collectStrings(obj);
    
    // ✅ Optimized batch translation with reasonable delays
    // Uses user's IP so no account suspension risk
    const batchSize = 10; // Balanced for performance
    const translations = [];
    
    for (let i = 0; i < strings.length; i += batchSize) {
      const batch = strings.slice(i, i + batchSize);
      
      // Translate batch in parallel
      const batchResults = await Promise.all(
        batch.map(text => this.translateText(text, sourceLang, targetLang))
      );
      
      translations.push(...batchResults);
      
      // Update progress
      this.translatedKeys = Math.min(i + batchSize, strings.length);
      const langIndex = this.targetLanguages.indexOf(this.currentLang);
      const totalLangs = this.targetLanguages.length;
      
      this.updateProgress(
        langIndex,
        totalLangs,
        `Translating to ${this.currentLang}... (${this.translatedKeys}/${this.totalKeys} keys)`
      );
      
      // Small delay between batches for stability
      if (i + batchSize < strings.length) {
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms for smooth operation
      }
    }
    
    // Rebuild object with translations
    const result = JSON.parse(JSON.stringify(obj)); // Deep clone
    
    paths.forEach((path, index) => {
      let current = result;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = translations[index];
    });
    
    return result;
  }

  async translateText(text, sourceLang, targetLang) {
    if (this.translationMode === 'google') {
      return await this.translateWithGoogle(text, sourceLang, targetLang);
    } else {
      return await this.translateWithAI(text, sourceLang, targetLang);
    }
  }

  async translateWithGoogle(text, sourceLang, targetLang) {
    try {
      // Use free client-side Google Translate API
      if (window.translateClient) {
        return await window.translateClient.translateWithRetry(text, targetLang, sourceLang || 'auto', 3);
      } else {
        console.error('TranslateClient not initialized');
        return text;
      }
    } catch (error) {
      console.error('Google translate error:', error);
      return text;
    }
  }

  async translateWithAI(text, sourceLang, targetLang) {
    try {
      const { apiKey } = await chrome.storage.sync.get(['apiKey']);
      
      if (!apiKey) {
        console.error('No API key for AI translation');
        return text;
      }
      
      const response = await fetch('https://localizeai-285680531861.us-central1.run.app/api/translate-json-ai', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ 
          text,
          sourceLang,
          targetLang
        })
      });
      
      if (!response.ok) {
        throw new Error(`AI translation failed: ${response.status}`);
      }
      
      const data = await response.json();
      return data.translatedText || text;
    } catch (error) {
      console.error('AI translate error:', error);
      return text;
    }
  }

  updateProgress(completed, total, message) {
    const percent = Math.round((completed / total) * 100);
    this.updateProgressBar(percent);
    document.getElementById('progress-text').textContent = message;
  }

  showResults() {
    document.getElementById('translation-progress').style.display = 'none';
    document.getElementById('translation-results').style.display = 'block';

    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = '';

    this.results.forEach((data, lang) => {
      const resultCard = document.createElement('div');
      resultCard.style.cssText = 'padding: 12px; background: white; border: 1px solid #ddd; border-radius: 10px; display: flex; align-items: center; justify-content: space-between;';
      
      resultCard.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${chrome.runtime.getURL('icons/lucide/file-json.svg')}" width="20" height="20">
          <div>
            <strong>${lang}.json</strong>
            <div style="font-size: 12px; color: #666;">${i18n('keysTranslated', this.countKeys(data))}</div>
          </div>
        </div>
        <button class="download-single-btn" data-lang="${lang}" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 12px;">
          ${i18n('download')}
        </button>
      `;
      
      resultsList.appendChild(resultCard);
    });

    // Attach download listeners
    document.querySelectorAll('.download-single-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lang = e.target.dataset.lang;
        this.downloadSingle(lang);
      });
    });

    showNotification(i18n('successfullyTranslatedTo', this.results.size), 'check-circle');
  }

  downloadSingle(lang) {
    const data = this.results.get(lang);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lang}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification(i18n('downloaded', `${lang}.json`), 'download');
  }

  downloadAll() {
    this.results.forEach((data, lang) => {
      setTimeout(() => this.downloadSingle(lang), 100);
    });
  }

  reset() {
    this.sourceFile = null;
    this.sourceData = null;
    this.targetLanguages = [];
    this.translationMode = null;
    this.results.clear();
    
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    // Show drop zone again
    const dropZone = document.getElementById('file-drop-zone');
    if (dropZone) {
      dropZone.style.display = 'block';
    }
    
    document.getElementById('file-preview').style.display = 'none';
    document.getElementById('translation-results').style.display = 'none';
    document.getElementById('translation-progress').style.display = 'none';
    document.getElementById('step-translate').style.display = 'block';
    
    this.disableStep('step-languages');
    this.disableStep('step-mode');
    this.disableStep('step-translate');
    
    document.querySelectorAll('.json-lang-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('json-file-input').value = '';
  }
}

// Global instance
window.jsonTranslator = new JSONTranslator();
