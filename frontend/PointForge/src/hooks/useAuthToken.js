import { useEffect } from 'react';

/**
 * Custom hook for token management
 * Note: With httpOnly cookies, we can't check token expiration client-side.
 * The backend JWT expires after 30 minutes, and authenticatedFetch will handle 401 responses automatically.
 * This hook now just listens for logout events.
 */
export function useAuthToken() {
    useEffect(() => {
        // Listen for logout events (handled by authenticatedFetch on 401)
        const handleTokenChange = (e) => {
            if (e.detail?.action === 'logout') {
                console.log('[useAuthToken] Logout event received');
            }
        };

        window.addEventListener('tokenChange', handleTokenChange);

        return () => {
            window.removeEventListener('tokenChange', handleTokenChange);
        };
    }, []);

    return {};
}

