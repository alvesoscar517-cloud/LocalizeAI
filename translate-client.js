// Client-side Google Translate API (Free)
// Uses the same API that Google Translate website uses
// No API key required, runs entirely on client-side

class TranslateClient {
  constructor() {
    this.baseURL = 'https://translate.googleapis.com/translate_a/single';
    this.cache = new Map(); // Cache translations to reduce API calls
    this.maxCacheSize = 1000;
  }

  /**
   * Translate text using Google Translate Web API (Free)
   * @param {string} text - Text to translate
   * @param {string} targetLang - Target language code (e.g., 'vi', 'en')
   * @param {string} sourceLang - Source language code (default: 'auto')
   * @returns {Promise<string>} Translated text
   */
  async translate(text, targetLang, sourceLang = 'auto') {
    try {
      // Validation
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input');
      }

      if (!targetLang || typeof targetLang !== 'string') {
        throw new Error('Invalid target language');
      }

      // Trim text
      text = text.trim();
      if (text.length === 0) {
        return '';
      }

      // Check cache first
      const cacheKey = `${sourceLang}:${targetLang}:${text}`;
      if (this.cache.has(cacheKey)) {
        console.log('[TranslateClient] Cache hit:', text.substring(0, 50));
        return this.cache.get(cacheKey);
      }

      // Build URL with parameters
      const params = new URLSearchParams({
        client: 'gtx',
        sl: sourceLang,
        tl: targetLang,
        dt: 't',
        q: text
      });

      const url = `${this.baseURL}?${params.toString()}`;

      // Make request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Translation API error: ${response.status}`);
      }

      const data = await response.json();

      // Parse response
      // Response format: [[[translated_text, original_text, null, null, 0]], null, source_lang]
      if (!data || !data[0] || !Array.isArray(data[0])) {
        throw new Error('Invalid response format');
      }

      // Combine all translated segments
      let translatedText = '';
      for (const segment of data[0]) {
        if (segment && segment[0]) {
          translatedText += segment[0];
        }
      }

      if (!translatedText) {
        throw new Error('Empty translation result');
      }

      // Cache the result
      this.addToCache(cacheKey, translatedText);

      console.log('[TranslateClient] Translated:', text.substring(0, 50), '→', translatedText.substring(0, 50));
      return translatedText;

    } catch (error) {
      console.error('[TranslateClient] Translation error:', error);
      throw error;
    }
  }

  /**
   * Batch translate multiple texts
   * @param {Array<string>} texts - Array of texts to translate
   * @param {string} targetLang - Target language code
   * @param {string} sourceLang - Source language code (default: 'auto')
   * @param {Function} onProgress - Progress callback (optional)
   * @returns {Promise<Array<string>>} Array of translated texts
   */
  async batchTranslate(texts, targetLang, sourceLang = 'auto', onProgress = null) {
    const results = [];
    const total = texts.length;

    for (let i = 0; i < texts.length; i++) {
      try {
        const translated = await this.translate(texts[i], targetLang, sourceLang);
        results.push(translated);

        // Call progress callback
        if (onProgress) {
          onProgress(i + 1, total);
        }

        // Small delay to avoid rate limiting
        if (i < texts.length - 1) {
          await this.delay(100); // Balanced delay for smooth operation
        }
      } catch (error) {
        console.error(`[TranslateClient] Failed to translate text ${i}:`, error);
        // Fallback to original text on error
        results.push(texts[i]);
      }
    }

    return results;
  }

  /**
   * Translate with retry logic
   * @param {string} text - Text to translate
   * @param {string} targetLang - Target language code
   * @param {string} sourceLang - Source language code
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<string>} Translated text
   */
  async translateWithRetry(text, targetLang, sourceLang = 'auto', maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.translate(text, targetLang, sourceLang);
      } catch (error) {
        lastError = error;
        console.warn(`[TranslateClient] Attempt ${attempt}/${maxRetries} failed:`, error.message);

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          await this.delay(delayMs);
        }
      }
    }

    throw lastError;
  }

  /**
   * Detect language of text
   * @param {string} text - Text to detect language
   * @returns {Promise<string>} Detected language code
   */
  async detectLanguage(text) {
    try {
      const params = new URLSearchParams({
        client: 'gtx',
        sl: 'auto',
        tl: 'en',
        dt: 't',
        q: text.substring(0, 500) // Only use first 500 chars for detection
      });

      const url = `${this.baseURL}?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Language detection error: ${response.status}`);
      }

      const data = await response.json();

      // Response format: [[[...]], null, detected_lang]
      if (data && data[2]) {
        return data[2];
      }

      return 'auto';
    } catch (error) {
      console.error('[TranslateClient] Language detection error:', error);
      return 'auto';
    }
  }

  /**
   * Add translation to cache
   * @param {string} key - Cache key
   * @param {string} value - Translated text
   */
  addToCache(key, value) {
    // Implement LRU cache - remove oldest if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  /**
   * Clear translation cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[TranslateClient] Cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize
    };
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
window.translateClient = new TranslateClient();

console.log('[TranslateClient] Initialized - Free Google Translate API ready');
