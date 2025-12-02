/**
 * localStorage Observer Utility
 * 
 * Detects localStorage changes in the same tab by intercepting localStorage methods.
 * The native 'storage' event only fires for changes in OTHER tabs/windows.
 * 
 * This utility wraps localStorage methods to dispatch custom events for same-tab changes.
 * Also uses polling as a backup to catch DevTools deletions that bypass our wrappers.
 */

let isInitialized = false;
let lastKnownToken = null;
let pollInterval = null;

/**
 * Check if token was deleted (for catching DevTools deletions)
 */
function checkTokenDeleted() {
    const currentToken = localStorage.getItem('token');
    
    // If we had a token before but don't now, it was deleted
    if (lastKnownToken !== null && currentToken === null && lastKnownToken !== currentToken) {
        console.log('[localStorageObserver] Token deleted via DevTools, dispatching event...');
        window.dispatchEvent(new CustomEvent('localStorageChange', {
            detail: {
                key: 'token',
                oldValue: lastKnownToken,
                newValue: null,
                storageArea: localStorage
            }
        }));
    }
    
    lastKnownToken = currentToken;
}

/**
 * Initialize localStorage observer to detect same-tab changes
 * This should be called once when the app starts
 */
export function initLocalStorageObserver() {
    if (isInitialized) {
        return; // Already initialized
    }

    // Initialize last known token
    lastKnownToken = localStorage.getItem('token');

    // Store original methods
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    const originalClear = Storage.prototype.clear;

    // Override setItem to dispatch custom event
    Storage.prototype.setItem = function(key, value) {
        const oldValue = this.getItem(key);
        originalSetItem.call(this, key, value);
        
        // Update last known token if this is the token key
        if (key === 'token') {
            lastKnownToken = value;
        }
        
        // Dispatch custom event for same-tab detection
        window.dispatchEvent(new CustomEvent('localStorageChange', {
            detail: {
                key,
                oldValue,
                newValue: value,
                storageArea: this
            }
        }));
    };

    // Override removeItem to dispatch custom event
    Storage.prototype.removeItem = function(key) {
        const oldValue = this.getItem(key);
        originalRemoveItem.call(this, key);
        
        // Update last known token if this is the token key
        if (key === 'token') {
            lastKnownToken = null;
        }
        
        // Dispatch custom event for same-tab detection
        window.dispatchEvent(new CustomEvent('localStorageChange', {
            detail: {
                key,
                oldValue,
                newValue: null,
                storageArea: this
            }
        }));
    };

    // Override clear to dispatch custom event
    Storage.prototype.clear = function() {
        // Store all keys before clearing
        const keys = [];
        for (let i = 0; i < this.length; i++) {
            const key = this.key(i);
            if (key) {
                keys.push({ key, value: this.getItem(key) });
            }
        }
        
        originalClear.call(this);
        
        // Dispatch events for each cleared key
        keys.forEach(({ key, value }) => {
            window.dispatchEvent(new CustomEvent('localStorageChange', {
                detail: {
                    key,
                    oldValue: value,
                    newValue: null,
                    storageArea: this
                }
            }));
        });
    };

    // Set up polling as backup to catch DevTools deletions (checks every 500ms)
    // This catches cases where DevTools UI deletes keys directly, bypassing our wrappers
    pollInterval = setInterval(() => {
        checkTokenDeleted();
    }, 500);

    isInitialized = true;
    console.log('[localStorageObserver] Initialized - same-tab localStorage changes will be detected');
}

/**
 * Cleanup function to stop polling (useful for testing or if needed)
 */
export function cleanupLocalStorageObserver() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

