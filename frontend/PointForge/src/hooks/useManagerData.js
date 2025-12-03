import { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from '../utils/api.js';

/**
 * Custom hook to fetch manager/superuser data (user summary and active promotions count)
 * Only fetches when user is a manager or superuser
 */
export function useManagerData(user) {
    const [userSummary, setUserSummary] = useState({ total: 0, flagged: [] });
    const [promotionsCount, setPromotionsCount] = useState(0);
    const [activePromotions, setActivePromotions] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const previousUserIdRef = useRef(null);
    const refreshTriggerRef = useRef(0);

    const isManagerOrSuperuser = user?.role === 'manager' || user?.role === 'superuser';

    // Reset state when user changes or logs out
    useEffect(() => {
        const currentUserId = user?.id;
        const previousUserId = previousUserIdRef.current;
        
        if (currentUserId !== previousUserId) {
            setUserSummary({ total: 0, flagged: [] });
            setPromotionsCount(0);
            setActivePromotions([]);
            setError('');
            setLoading(false);
            previousUserIdRef.current = currentUserId;
        }
    }, [user?.id]);

    useEffect(() => {
        if (!user || !isManagerOrSuperuser) {
            setUserSummary({ total: 0, flagged: [] });
            setPromotionsCount(0);
            setActivePromotions([]);
            return;
        }

        let ignore = false;

        const fetchManagerData = async () => {
            setLoading(true);
            setError('');
            try {
                // Fetch users to get total count and flagged users
                const usersResponse = await authenticatedFetch('/users?limit=100&page=1', {
                    method: 'GET'
                });

                if (!usersResponse.ok) {
                    if (usersResponse.status === 401) {
                        // authenticatedFetch handles logout automatically
                        return;
                    }
                    const errorData = await usersResponse.json().catch(() => ({}));
                    throw new Error(errorData.Message || `HTTP ${usersResponse.status}: Unable to load user overview`);
                }

                const usersData = await usersResponse.json();
                
                // Fetch promotions to get total count and active promotions list (for managers, get all active promotions)
                const promotionsResponse = await authenticatedFetch('/promotions?limit=100&page=1&ended=false', {
                    method: 'GET'
                });

                let activePromosCount = 0;
                let activePromotionsList = [];
                if (promotionsResponse.ok) {
                    const promotionsData = await promotionsResponse.json();
                    // Count should be based on filtered results, not the total count from API
                    // Filter to only include truly active promotions (started and not ended)
                    const now = Date.now();
                    activePromotionsList = (promotionsData.results || []).filter(promo => {
                        const startTime = Date.parse(promo.startTime);
                        const endTime = Date.parse(promo.endTime);
                        return startTime <= now && now < endTime;
                    });
                    activePromosCount = activePromotionsList.length;
                }
                
                if (!ignore) {
                    const allUsers = usersData.results || [];
                    const flaggedUsers = allUsers.filter((u) => u.suspicious || !u.verified);
                    
                    setUserSummary({
                        total: usersData.count || allUsers.length || 0,
                        flagged: flaggedUsers
                    });
                    setPromotionsCount(activePromosCount);
                    setActivePromotions(activePromotionsList);
                }
            } catch (err) {
                console.error('Error fetching manager data:', err);
                if (!ignore) {
                    // If session expired, don't show error - user is being logged out
                    if (err.message === 'Session expired' || err.message === 'No authentication token') {
                        return;
                    }
                    setError(err.message || 'Manager overview failed');
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        };

        fetchManagerData();
        return () => {
            ignore = true;
        };
    }, [user?.id, user?.role, isManagerOrSuperuser, refreshTriggerRef.current]);

    // Refresh function to manually trigger data refetch
    const refresh = () => {
        refreshTriggerRef.current += 1;
    };

    return {
        userSummary,
        promotionsCount,
        activePromotions,
        error,
        loading,
        refresh
    };
}
