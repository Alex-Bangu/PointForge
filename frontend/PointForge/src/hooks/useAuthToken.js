import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Custom hook to track JWT token expiration and automatically log out the user
 * when the token expires. This prevents users from seeing "No authentication token" errors.
 * 
 * Checks token expiration every 30 seconds and also sets up a one-time timeout
 * to log out exactly when the token expires.
 */
export function useAuthToken() {
    const navigate = useNavigate();
    const timeoutRef = useRef(null);
    const intervalRef = useRef(null);

    const logout = () => {
        console.log('[useAuthToken] Token expired, logging out user...');
        // Clear token and expiration
        localStorage.removeItem('token');
        localStorage.removeItem('tokenExpiresAt');
        
        // Dispatch event to notify UserContext
        window.dispatchEvent(new CustomEvent('tokenChange', { detail: { action: 'logout' } }));
        
        // Use window.location.href for immediate navigation to prevent React rendering errors
        // This ensures we navigate before React tries to render components with null user
        // Allow login sub-routes (register, forgot, etc.)
        if (!window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
        }
    };

    const checkTokenExpiration = () => {
        const token = localStorage.getItem('token');
        const expiresAt = localStorage.getItem('tokenExpiresAt');

        // If token is missing but we were logged in, log out immediately
        if (!token) {
            // Check if we have expiration (meaning we were logged in before)
            if (expiresAt) {
                console.log('[useAuthToken] Token removed, logging out...');
                logout();
            }
            // Clear any existing timeouts
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            return;
        }

        // If we have token but no expiration, that's odd but continue
        if (!expiresAt) {
            console.warn('[useAuthToken] Token exists but no expiration time found');
            return;
        }

        const expirationTime = new Date(expiresAt).getTime();
        const now = Date.now();
        const timeUntilExpiration = expirationTime - now;

        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (timeUntilExpiration <= 0) {
            // Token already expired, log out immediately
            console.log('[useAuthToken] Token already expired, logging out now');
            logout();
        } else {
            // Set timeout to log out exactly when token expires
            const minutesUntilExpiration = Math.floor(timeUntilExpiration / 60000);
            const secondsUntilExpiration = Math.floor((timeUntilExpiration % 60000) / 1000);
            console.log(`[useAuthToken] Token expires in ${minutesUntilExpiration}m ${secondsUntilExpiration}s. Auto-logout scheduled.`);
            timeoutRef.current = setTimeout(() => {
                logout();
            }, timeUntilExpiration);
        }
    };

    useEffect(() => {
        // Check immediately on mount
        checkTokenExpiration();

        // Set up interval to check every 30 seconds (backup for edge cases)
        // The localStorage observer handles immediate detection, this is just a safety net
        intervalRef.current = setInterval(() => {
            checkTokenExpiration();
        }, 30000); // Check every 30 seconds

        // Also listen for token changes (login/logout)
        const handleTokenChange = () => {
            checkTokenExpiration();
        };

        window.addEventListener('tokenChange', handleTokenChange);
        
        // Listen for storage changes (works across tabs)
        const handleStorageChange = (e) => {
            if (e.key === 'token') {
                if (!e.newValue) {
                    // Token was removed (from another tab)
                    console.log('[useAuthToken] Token removed from storage (cross-tab), logging out...');
                    logout();
                } else {
                    // Token was added/updated
                    checkTokenExpiration();
                }
            } else if (e.key === 'tokenExpiresAt') {
                checkTokenExpiration();
            }
        };
        
        // Listen for same-tab localStorage changes (via our custom observer)
        const handleLocalStorageChange = (e) => {
            const { key, newValue } = e.detail;
            if (key === 'token') {
                if (!newValue) {
                    // Token was removed (same tab - manual removal or programmatic)
                    console.log('[useAuthToken] Token removed from storage (same tab), logging out...');
                    logout();
                } else {
                    // Token was added/updated
                    checkTokenExpiration();
                }
            } else if (key === 'tokenExpiresAt') {
                checkTokenExpiration();
            }
        };
        
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('localStorageChange', handleLocalStorageChange);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            window.removeEventListener('tokenChange', handleTokenChange);
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('localStorageChange', handleLocalStorageChange);
        };
    }, [navigate]);

    return { checkTokenExpiration };
}

