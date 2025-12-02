import {createContext, useCallback, useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import { API_BASE_URL, getAuthHeaders } from "../utils/api.js";
import { useAuthToken } from "../hooks/useAuthToken.js";

export const UserContext = createContext({
    user: null,
    events: [],
    promotions: [],
    transactions: [],
    loading: true,
    error: '',
    refreshUserData: () => {},
    resetUserData: () => {}
});

export function UserProvider({ children }) {
    const [user, setUser] = useState(null);
    const [events, setEvents] = useState([]);
    const [promotions, setPromotions] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    
    // Track token expiration and auto-logout
    useAuthToken();

    const refreshUserData = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        console.log("token: ", token);
        if (!token) {
            setUser(null);
            setEvents([]);
            setPromotions([]);
            setTransactions([]);
            setLoading(false); // Set loading to false so components don't get stuck
            // Navigate immediately - but allow login sub-routes (register, forgot, etc.)
            if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
            return;
        }

        const headers = getAuthHeaders();

        try {
            const userResponse = await fetch(`${API_BASE_URL}/users/me`, {
                method: 'GET',
                headers,
            });

            if (!userResponse.ok) {
                if (userResponse.status === 401) {
                    // Token expired or invalid - clear everything
                    localStorage.removeItem('token');
                    localStorage.removeItem('tokenExpiresAt');
                    setUser(null);
                    setEvents([]);
                    setPromotions([]);
                    setTransactions([]);
                    setLoading(false);
                    navigate('/login');
                    return;
                }
                setError('Failed to fetch user data');
            }

            const userData = await userResponse.json();
            console.log(userData);
            setUser(userData);

            const eventsResponse = await fetch(`${API_BASE_URL}/events`, {
                method: 'GET',
                headers,
            });

            if (eventsResponse.ok) {
                const eventsData = await eventsResponse.json();
                setEvents(eventsData.results || []);
            }

            const promotionsResponse = await fetch(`${API_BASE_URL}/promotions`, {
                method: 'GET',
                headers,
            });

            if (promotionsResponse.ok) {
                const promotionsData = await promotionsResponse.json();
                setPromotions(promotionsData.results || []);
            }

            const transactionsResponse = await fetch(`${API_BASE_URL}/users/me/transactions`, {
                method: 'GET',
                headers,
            });

            if (transactionsResponse.ok) {
                const transactionsData = await transactionsResponse.json();
                setTransactions(transactionsData.results || []);
            }

        } catch (err) {
            setError('Failed to load dashboard data');
            console.error(err);
        }

        setLoading(false);
        console.log("The end")
    }, [navigate]);

    const resetUserData = useCallback(() => {
        setUser(null);
        setEvents([]);
        setPromotions([]);
        setTransactions([]);
        setError('');
        setLoading(false);
        // Also clear token expiration when resetting
        localStorage.removeItem('tokenExpiresAt');
    }, []);

    // Watch for token changes via custom events and storage events
    useEffect(() => {
        const handleTokenChange = (e) => {
            if (e.detail?.action === 'logout') {
                resetUserData();
            } else if (e.detail?.action === 'login') {
                refreshUserData();
            }
        };

        const handleStorageChange = (e) => {
            if (e.key === 'token') {
                if (e.newValue) {
                    refreshUserData();
                } else {
                    resetUserData();
                }
            }
        };

        // Listen for custom token change events
        window.addEventListener('tokenChange', handleTokenChange);
        // Listen for storage events (works across tabs)
        window.addEventListener('storage', handleStorageChange);

        // Check on mount
        const token = localStorage.getItem('token');
        if (token) {
            refreshUserData();
        } else {
            // No token on mount - reset and navigate to login immediately
            resetUserData();
            // Only navigate if we're not already on login page or its sub-routes
            if (!window.location.pathname.startsWith('/login') && window.location.pathname !== '/') {
                navigate('/login');
            }
        }

        return () => {
            window.removeEventListener('tokenChange', handleTokenChange);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [refreshUserData, resetUserData]);

    const context = useMemo(() => ({
        user,
        events,
        promotions,
        transactions,
        loading,
        error,
        refreshUserData,
        resetUserData
    }), [user, events, promotions, transactions, loading, error, refreshUserData, resetUserData]);

    return (
        <UserContext.Provider value={context}>
            {children}
        </UserContext.Provider>
    );
}



