import {createContext, useCallback, useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import { API_BASE_URL, authenticatedFetch } from "../utils/api.js";
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

        try {
            // Use authenticatedFetch which automatically includes httpOnly cookies
            const userResponse = await authenticatedFetch('/users/me', {
                method: 'GET',
            });

            if (!userResponse.ok) {
                if (userResponse.status === 401) {
                    // Token expired or invalid - authenticatedFetch already handled logout
                    setUser(null);
                    setEvents([]);
                    setPromotions([]);
                    setTransactions([]);
                    setLoading(false);
                    return;
                }
                setError('Failed to fetch user data');
                setLoading(false);
                return;
            }

            const userData = await userResponse.json();
            console.log(userData);
            setUser(userData);

            // Fetch events, promotions, and transactions using authenticatedFetch
            const eventsResponse = await authenticatedFetch('/events', {
                method: 'GET',
            });

            if (eventsResponse.ok) {
                const eventsData = await eventsResponse.json();
                setEvents(eventsData.results || []);
            }

            const promotionsResponse = await authenticatedFetch('/promotions', {
                method: 'GET',
            });

            if (promotionsResponse.ok) {
                const promotionsData = await promotionsResponse.json();
                setPromotions(promotionsData.results || []);
            }

            const transactionsResponse = await authenticatedFetch('/users/me/transactions', {
                method: 'GET',
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
    }, []);

    const resetUserData = useCallback(() => {
        setUser(null);
        setEvents([]);
        setPromotions([]);
        setTransactions([]);
        setError('');
        setLoading(false);
        // No need to clear localStorage - token is in httpOnly cookie
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

        // Listen for custom token change events
        window.addEventListener('tokenChange', handleTokenChange);

        // Check on mount - try to fetch user data (will fail if no cookie)
        // authenticatedFetch will handle 401 and redirect to login
        refreshUserData();

        return () => {
            window.removeEventListener('tokenChange', handleTokenChange);
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



