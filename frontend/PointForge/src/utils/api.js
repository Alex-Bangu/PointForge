/**
 * API utility functions for making authenticated HTTP requests
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * Get authentication headers with Bearer token
 * @returns {Object} Headers object with Authorization and Content-Type
 */
export const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
    };
    
    // Only add Authorization header if token exists
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
};

/**
 * Get headers without authentication (for public endpoints)
 * @returns {Object} Headers object with Content-Type only
 */
export const getHeaders = () => {
    return {
        'Content-Type': 'application/json',
    };
};

/**
 * Helper function to handle authentication errors and automatically log out
 * This navigates to login page immediately to prevent errors
 */
const handleAuthError = () => {
    // Remove token and expiration
    localStorage.removeItem('token');
    localStorage.removeItem('tokenExpiresAt');
    
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
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export const authenticatedFetch = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    
    if (!token && !options.skipAuth) {
        // Token is missing, log out immediately and navigate
        handleAuthError();
        // Return a rejected promise - but navigation already happened
        return Promise.reject(new Error('Session expired'));
    }

    const headers = getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            ...headers,
            ...options.headers,
        },
    });

    // Handle 401 Unauthorized responses globally
    if (response.status === 401) {
        handleAuthError();
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
        headers: {
            ...headers,
            ...options.headers,
        },
    });
};
