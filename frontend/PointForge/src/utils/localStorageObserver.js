/**
 * localStorage Observer Utility
 * 
 * DEPRECATED: This utility is no longer used. We now use httpOnly cookies for authentication.
 * 
 * This file exists for backward compatibility only and does nothing.
 */

/**
 * Initialize localStorage observer to detect same-tab changes
 * DEPRECATED: No longer needed with httpOnly cookies
 */
export function initLocalStorageObserver() {
    // No-op: We use httpOnly cookies now, so localStorage observation is not needed
    return;
}

/**
 * Cleanup function to stop polling (useful for testing or if needed)
 * DEPRECATED: No longer needed
 */
export function cleanupLocalStorageObserver() {
    // No-op: Nothing to clean up
    return;
}

