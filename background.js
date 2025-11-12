// Background service worker
console.log('LocalizeAI background script loaded');

const BACKEND_URL = 'https://localizeai-285680531861.us-central1.run.app';

// Initialize on load - check if user is already logged in
(async () => {
  try {
    const { user, apiKey, authToken } = await chrome.storage.sync.get(['user', 'apiKey', 'authToken']);
    
    if (user && apiKey && authToken) {
      console.log('User session restored:', user.email);
      // Sync subscription status in background
      syncSubscriptionStatus().catch(err => {
        console.error('Failed to sync subscription on load:', err);
      });
    } else {
      console.log('No existing user session');
    }
  } catch (error) {
    console.error('Error checking user session:', error);
  }
})();

// Listen for installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('LocalizeAI installed/updated:', details.reason);
  
  // Only initialize on fresh install, not on update
  if (details.reason === 'install') {
    console.log('First time install - initializing storage');
    await chrome.storage.sync.set({
      usageCount: 0,
      apiKey: null,
      user: null,
      authToken: null
      // sourceLanguage and targetLanguage will be auto-detected on first use
    });
  } else if (details.reason === 'update') {
    console.log('Extension updated - preserving user data');
    // Check if user is logged in and sync subscription
    const { user, apiKey } = await chrome.storage.sync.get(['user', 'apiKey']);
    if (user && apiKey) {
      console.log('User logged in - syncing subscription status');
      await syncSubscriptionStatus();
    }
  }
});

// Check subscription status on startup (browser restart)
chrome.runtime.onStartup.addListener(async () => {
  console.log('LocalizeAI started - checking user session');
  
  // Check if user is logged in
  const { user, apiKey, authToken } = await chrome.storage.sync.get(['user', 'apiKey', 'authToken']);
  
  if (user && apiKey && authToken) {
    console.log('User session found:', user.email);
    // Sync subscription status to get latest data
    await syncSubscriptionStatus();
  } else {
    console.log('No user session found');
  }
});

// Sync subscription status periodically (every hour)
setInterval(syncSubscriptionStatus, 60 * 60 * 1000);

// Note: action.onClicked is not used when default_popup is set in manifest.json
// The popup.html/popup.js handles the logic for opening sidebar or showing unsupported message

// Handle messages from content script and options page
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'checkSubscription') {
    syncSubscriptionStatus().then(sendResponse);
    return true;
  }
  
  if (request.action === 'signInWithGoogle') {
    handleSignIn().then(sendResponse);
    return true;
  }
  
  if (request.action === 'signOut') {
    handleSignOut().then(sendResponse);
    return true;
  }
  
  if (request.action === 'clearAuthCache') {
    clearAuthCache().then(sendResponse);
    return true;
  }
  
  if (request.action === 'fetchImageAsDataUrl') {
    fetchImageAsDataUrl(request.url).then(sendResponse).catch(err => {
      console.error('Failed to fetch image:', err);
      sendResponse({ error: err.message });
    });
    return true;
  }
  
  if (request.action === 'refreshUserInfo') {
    refreshUserInfoFromGoogle().then(sendResponse).catch(err => {
      console.error('Failed to refresh user info:', err);
      sendResponse({ error: err.message });
    });
    return true;
  }
});

// Fetch image from external URL and convert to data URL
async function fetchImageAsDataUrl(imageUrl) {
  try {
    console.log('[Background] Fetching image from:', imageUrl);
    
    // For Google profile images, we can use them directly without CORS issues
    // by ensuring the URL has proper size parameter
    let url = imageUrl;
    
    // If it's a Google user content URL, ensure it has size parameter
    if (imageUrl.includes('googleusercontent.com')) {
      // Remove any existing size parameters and add our own
      url = imageUrl.split('=')[0] + '=s96-c';
      console.log('[Background] Modified Google image URL:', url);
    }
    
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'force-cache',
      credentials: 'omit',
      headers: {
        'Accept': 'image/*'
      }
    });
    
    console.log('[Background] Fetch response status:', response.status);
    console.log('[Background] Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    console.log('[Background] Blob received, size:', blob.size, 'type:', blob.type);
    
    if (blob.size === 0) {
      throw new Error('Received empty image blob');
    }
    
    // Convert blob to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('[Background] Image converted to data URL successfully, length:', reader.result.length);
        resolve({ dataUrl: reader.result });
      };
      reader.onerror = (error) => {
        console.error('[Background] FileReader error:', error);
        reject(new Error('Failed to convert image to data URL'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[Background] Error fetching image:', error);
    throw error;
  }
}

// Handle sign in from options page
async function handleSignIn() {
  try {
    // Get OAuth token
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });

    console.log('[Auth] Got OAuth token, fetching user info from Google...');

    // Get user info directly from Google API (for picture, name, etc.)
    let googleUserInfo = null;
    try {
      const googleResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (googleResponse.ok) {
        const contentType = googleResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          googleUserInfo = await googleResponse.json();
          console.log('[Auth] Google user info:', googleUserInfo);
          console.log('[Auth] Picture URL from Google:', googleUserInfo.picture);
        } else {
          console.error('[Auth] Google API returned non-JSON response');
        }
      } else if (googleResponse.status === 401) {
        // Token expired or invalid - remove cached token and retry
        console.warn('[Auth] Token invalid (401), removing cached token and retrying...');
        await new Promise((resolve) => {
          chrome.identity.removeCachedAuthToken({ token }, () => {
            resolve();
          });
        });
        
        // Get new token
        const newToken = await new Promise((resolve, reject) => {
          chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(token);
            }
          });
        });
        
        // Retry with new token
        const retryResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${newToken}` }
        });
        
        if (retryResponse.ok) {
          const contentType = retryResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            googleUserInfo = await retryResponse.json();
            console.log('[Auth] Google user info (retry):', googleUserInfo);
          } else {
            console.error('[Auth] Google API returned non-JSON response on retry');
          }
        } else {
          console.error('[Auth] Failed to fetch Google user info after retry, status:', retryResponse.status);
        }
      } else {
        console.error('[Auth] Failed to fetch Google user info, status:', googleResponse.status);
      }
    } catch (err) {
      console.warn('[Auth] Failed to fetch Google user info:', err);
    }

    // Verify with backend (only for API key and premium status)
    let userData;
    let apiKey = null;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Auth] Backend error:', response.status, errorText);
        
        // Fallback: Use Google data only if backend fails
        if (!googleUserInfo) {
          throw new Error('No user info available from Google');
        }
        
        console.warn('[Auth] Backend unavailable, using Google auth only (free tier)');
        userData = {
          email: googleUserInfo.email,
          name: googleUserInfo.name,
          picture: googleUserInfo.picture || null,
          isPremium: false
        };
      } else {
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const responseText = await response.text();
          console.error('[Auth] Backend returned non-JSON response:', responseText);
          
          // Fallback to Google data
          userData = {
            email: googleUserInfo.email,
            name: googleUserInfo.name,
            picture: googleUserInfo.picture || null,
            isPremium: false
          };
        } else {
          const data = await response.json();
          console.log('[Auth] Backend response:', data);

          // Combine backend data (apiKey, isPremium) with Google data (picture, name)
          userData = {
            email: googleUserInfo?.email || data.user.email,
            name: googleUserInfo?.name || data.user.email.split('@')[0],
            picture: googleUserInfo?.picture || null,
            isPremium: data.user.isPremium || false
          };
          
          // Save API key from backend
          apiKey = data.apiKey;
        }
      }
    } catch (error) {
      console.error('[Auth] Backend request failed:', error);
      
      // Fallback: Use Google data only
      if (!googleUserInfo) {
        throw new Error('Authentication failed: No user info available');
      }
      
      console.warn('[Auth] Using Google auth only (free tier)');
      userData = {
        email: googleUserInfo.email,
        name: googleUserInfo.name,
        picture: googleUserInfo.picture || null,
        isPremium: false
      };
    }

    console.log('[Auth] Final user data:', userData);
    console.log('[Auth] Picture URL:', userData.picture || 'No picture available');
    
    if (!userData.picture) {
      console.warn('[Auth] No picture URL from Google (user may not have profile picture)');
    }

    // Save user data
    const storageData = {
      user: userData,
      authToken: token
    };
    
    if (apiKey) {
      storageData.apiKey = apiKey;
    }
    
    await chrome.storage.sync.set(storageData);
    
    console.log('[Auth] User data saved to storage');
    
    // Verify saved data
    const savedData = await chrome.storage.sync.get(['user']);
    console.log('[Auth] Verified saved user data:', savedData.user);
    console.log('[Auth] Verified saved picture:', savedData.user?.picture);

    // Sync subscription
    await syncSubscriptionStatus();

    return userData;
  } catch (error) {
    console.error('[Auth] Sign in error:', error);
    throw error;
  }
}

// Refresh user info from Google (to get latest picture, name, etc.)
// This is called when opening sidebar to ensure avatar is always up-to-date
// Backend doesn't store or return avatar - we get it directly from Google
async function refreshUserInfoFromGoogle() {
  try {
    console.log('[Auth] Refreshing user info from Google...');
    
    const { authToken, user, apiKey } = await chrome.storage.sync.get(['authToken', 'user', 'apiKey']);
    
    if (!authToken) {
      console.log('[Auth] No auth token found');
      return { error: 'Not signed in' };
    }
    
    // Get fresh user info directly from Google API
    // This includes: email, name, picture (avatar URL)
    let googleResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    // Handle 401 - token expired
    if (googleResponse.status === 401) {
      console.warn('[Auth] Token expired (401), removing cached token and getting new one...');
      
      // Remove cached token
      await new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: authToken }, () => {
          resolve();
        });
      });
      
      // Get new token
      const newToken = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(token);
          }
        });
      });
      
      // Update auth token in storage
      await chrome.storage.sync.set({ authToken: newToken });
      
      // Retry with new token
      googleResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${newToken}` }
      });
    }
    
    if (!googleResponse.ok) {
      console.error('[Auth] Failed to fetch Google user info, status:', googleResponse.status);
      return { error: 'Failed to fetch user info' };
    }
    
    const contentType = googleResponse.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await googleResponse.text();
      console.error('[Auth] Google API returned non-JSON response:', responseText);
      return { error: 'Invalid response from Google API' };
    }
    
    const googleUserInfo = await googleResponse.json();
    console.log('[Auth] Fresh Google user info:', googleUserInfo);
    
    // Update user data in storage with fresh info from Google
    // Keep isPremium from existing user data (managed by backend)
    const updatedUser = {
      ...user,
      email: googleUserInfo.email,
      name: googleUserInfo.name,
      picture: googleUserInfo.picture // Avatar URL from Google
    };
    
    await chrome.storage.sync.set({ user: updatedUser });
    console.log('[Auth] User info updated with fresh data from Google');
    
    return { user: updatedUser };
  } catch (error) {
    console.error('[Auth] Error refreshing user info:', error);
    return { error: error.message };
  }
}

// Handle sign out from options page
async function handleSignOut() {
  try {
    console.log('[Auth] Starting sign out process...');
    const data = await chrome.storage.sync.get(['authToken']);
    
    if (data.authToken) {
      console.log('[Auth] Removing cached token...');
      
      // Remove cached token
      await new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: data.authToken }, () => {
          console.log('[Auth] Cached token removed');
          resolve();
        });
      });
      
      // Revoke token to force re-authentication
      try {
        console.log('[Auth] Revoking token...');
        await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${data.authToken}`);
        console.log('[Auth] Token revoked successfully');
      } catch (revokeError) {
        console.warn('[Auth] Failed to revoke token:', revokeError);
      }
      
      // Clear all cached auth tokens (force clean)
      await new Promise((resolve) => {
        chrome.identity.clearAllCachedAuthTokens(() => {
          console.log('[Auth] All cached tokens cleared');
          resolve();
        });
      });
    }

    // Clear storage
    await chrome.storage.sync.set({
      user: null,
      apiKey: null,
      authToken: null
    });

    console.log('[Auth] Sign out complete');
    return true;
  } catch (error) {
    console.error('[Auth] Sign out error:', error);
    throw error;
  }
}

// Sync subscription status with backend
async function syncSubscriptionStatus() {
  try {
    const { apiKey, user, authToken } = await chrome.storage.sync.get(['apiKey', 'user', 'authToken']);
    
    if (!apiKey || !user) {
      console.log('No user or API key - skipping sync');
      return { tier: 'free' };
    }

    console.log('Syncing subscription for:', user.email);

    const response = await fetch(`${BACKEND_URL}/api/subscription/status`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    if (!response.ok) {
      // If unauthorized (401), token might be expired
      if (response.status === 401) {
        console.warn('Token expired or invalid - keeping user logged in with free tier');
        // Don't sign out, just set to free tier
        await chrome.storage.sync.set({ 
          user: {
            ...user,
            isPremium: false,
            tier: 'free'
          }
        });
        return { tier: 'free' };
      }
      
      console.error('Failed to sync subscription status:', response.status);
      return { tier: 'free' };
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await response.text();
      console.error('[Subscription] Backend returned non-JSON response:', responseText);
      return { tier: 'free' };
    }
    
    const data = await response.json();
    
    // Update local storage with fresh data (keep existing user data like name, picture)
    await chrome.storage.sync.set({ 
      user: {
        ...user,  // ✅ Keep all existing user data (name, picture, etc.)
        isPremium: data.isPremium  // Only update isPremium from backend
      }
    });
    
    console.log('Subscription synced successfully. isPremium:', data.isPremium);
    return data;
  } catch (error) {
    console.error('Error syncing subscription:', error);
    // Don't clear user data on network errors
    return { tier: 'free' };
  }
}
