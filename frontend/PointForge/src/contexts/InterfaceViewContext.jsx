import { createContext, useContext, useState, useEffect } from 'react';
import { UserContext } from './UserContext.jsx';

export const InterfaceViewContext = createContext({
    interfaceView: null,
    setInterfaceView: () => {},
    effectiveRole: null,
    availableViews: []
});

export function InterfaceViewProvider({ children }) {
    const { user, loading } = useContext(UserContext);
    
    // Initialize interfaceView from localStorage synchronously (not in useEffect)
    // This ensures effectiveRole is calculated correctly on first render
    const getInitialInterfaceView = () => {
        if (typeof window === 'undefined') return null; // SSR safety
        const savedView = localStorage.getItem('interfaceView');
        if (savedView && ['regular', 'cashier', 'manager', 'organizer'].includes(savedView)) {
            return savedView;
        }
        return null;
    };
    
    const [interfaceView, setInterfaceViewState] = useState(getInitialInterfaceView);

    // Save interface view to localStorage when it changes
    const setInterfaceView = (view) => {
        if (view === null) {
            localStorage.removeItem('interfaceView');
            setInterfaceViewState(null);
        } else {
            localStorage.setItem('interfaceView', view);
            setInterfaceViewState(view);
        }
    };

    // Determine available views based on user's actual roles
    const availableViews = [];
    if (user) {
        availableViews.push('regular'); // Everyone can view as regular
        
        if (user.role === 'cashier' || user.role === 'manager' || user.role === 'superuser') {
            availableViews.push('cashier');
        }
        
        if (user.role === 'manager' || user.role === 'superuser') {
            availableViews.push('manager');
        }
        
        // Check if user is an event organizer (has organized events)
        if (user.organizedEvents && user.organizedEvents.length > 0) {
            availableViews.push('organizer');
        }
    }

    // Validate and reset interfaceView if it's no longer available when user loads
    useEffect(() => {
        if (user && interfaceView && !availableViews.includes(interfaceView)) {
            // The saved interface view is no longer valid (e.g., user lost permissions)
            setInterfaceViewState(null);
            localStorage.removeItem('interfaceView');
        }
    }, [user, interfaceView, availableViews]);

    // Determine effective role for UI display
    // Priority: 
    // 1. If interfaceView is set AND user has loaded AND it's available -> use interfaceView
    // 2. If interfaceView is set BUT user hasn't loaded yet -> use interfaceView (optimistic)
    // 3. If interfaceView is set BUT user loaded and it's NOT available -> fall back to user role
    // 4. Otherwise -> use actual user role
    const effectiveRole = (() => {
        if (!interfaceView) {
            return user?.role || 'regular';
        }
        
        // If user hasn't loaded yet, optimistically use interfaceView
        if (!user) {
            return interfaceView;
        }
        
        // User has loaded - check if interfaceView is valid
        if (availableViews.includes(interfaceView)) {
            return interfaceView;
        }
        
        // interfaceView is set but not valid for this user - fall back to actual role
        return user.role || 'regular';
    })();

    // Reset interface view if user logs out (but not during initial load)
    useEffect(() => {
        // Only clear interfaceView if user is explicitly null AND we're not loading
        // This prevents clearing during initial page load when user is temporarily null
        if (!user && !loading) {
            setInterfaceViewState(null);
            localStorage.removeItem('interfaceView');
        }
    }, [user, loading]);

    return (
        <InterfaceViewContext.Provider value={{
            interfaceView,
            setInterfaceView,
            effectiveRole,
            availableViews
        }}>
            {children}
        </InterfaceViewContext.Provider>
    );
}

export const useInterfaceView = () => {
    const context = useContext(InterfaceViewContext);
    if (!context) {
        throw new Error('useInterfaceView must be used within InterfaceViewProvider');
    }
    return context;
};

