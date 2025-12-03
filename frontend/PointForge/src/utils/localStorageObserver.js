/**
 * localStorage Observer Utility
 * 
 * NOTE: This utility is deprecated. We now use httpOnly cookies for authentication,
 * so we don't need to observe localStorage token changes.
 * 
 * This file is kept for backward compatibility but does nothing.
 * It will be removed in a future version.
 */

/**
 * Initialize localStorage observer to detect same-tab changes
 * DEPRECATED: No longer needed with httpOnly cookies
 */
export function initLocalStorageObserver() {
    // No-op: We use httpOnly cookies now, so localStorage observation is not needed
    // This function exists for backward compatibility only
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

