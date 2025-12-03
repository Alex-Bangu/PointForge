/**
 * API utility functions for making authenticated HTTP requests
 * Uses httpOnly cookies for same-domain, Authorization headers for cross-domain
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Store token in memory (not localStorage) for cross-domain fallback
let authToken = null;

/**
 * Set the authentication token (called after login)
 * @param {string} token - JWT token
 */
export const setAuthToken = (token) => {
    authToken = token;
};

/**
 * Clear the authentication token (called on logout)
 */
export const clearAuthToken = () => {
    authToken = null;
};

/**
 * Get headers for requests
 * Includes Authorization header if token is available (for cross-domain fallback)
 * @returns {Object} Headers object with Content-Type and optionally Authorization
 */
export const getHeaders = () => {
    const headers = {
        'Content-Type': 'application/json',
    };
    
    // Add Authorization header if token is available (for cross-domain scenarios)
    // Backend will prefer cookie if available, but will accept Authorization header as fallback
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    return headers;
};

/**
 * Helper function to handle authentication errors and automatically log out
 * This navigates to login page immediately to prevent errors
 */
const handleAuthError = async () => {
    // Clear in-memory token
    clearAuthToken();
    
    // Call logout endpoint to clear httpOnly cookie
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: getHeaders()
        });
    } catch (err) {
        // Ignore errors - we're logging out anyway
    }
    
    // Dispatch event to notify UserContext and other components
    window.dispatchEvent(new CustomEvent('tokenChange', { detail: { action: 'logout' } }));
    
    // Navigate to login immediately to prevent components from trying to use null token
    // Allow login sub-routes (register, forgot, etc.)
    if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
    }
};

/**
 * Make an authenticated fetch request
 * Uses httpOnly cookies (sent automatically with credentials: 'include')
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export const authenticatedFetch = async (endpoint, options = {}) => {
    const headers = getHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include', // Include httpOnly cookies
        headers: {
            ...headers,
            ...options.headers,
        },
    });

    // Handle 401 Unauthorized responses globally
    if (response.status === 401) {
        await handleAuthError();
        // Return a response that can be handled by the caller
        // but the user will already be logged out
        return response;
    }

    return response;
};

/**
 * Make an unauthenticated fetch request
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export const unauthenticatedFetch = async (endpoint, options = {}) => {
    const headers = getHeaders();
    
    return fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include', // Include cookies even for unauthenticated requests (needed for login)
        headers: {
            ...headers,
            ...options.headers,
        },
    });
};
