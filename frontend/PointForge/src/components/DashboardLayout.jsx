import './DashboardLayout.css';
import {Link, Outlet, useLocation, useNavigate} from "react-router-dom";
import {useState, useEffect, useContext} from "react";
import {Error} from "./index.js";
import {UserContext} from "../contexts/UserContext.jsx";
import {useLanguage} from "../contexts/LanguageContext.jsx";
import {useInterfaceView} from "../contexts/InterfaceViewContext.jsx";
import {isActive} from "../utils/dateUtils.js";

const DashboardLayout = () => {
    const {user} = useContext(UserContext);
    const {effectiveRole} = useInterfaceView();
    const {t} = useLanguage();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [hamburgerVisible, setHamburgerVisible] = useState(true);
    const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const NAVIGATION_ITEMS = [
        { path: '/dashboard', label: t('nav.home') },
        { path: '/dashboard/transactions', label: t('nav.transactions') },
        { path: '/dashboard/events', label: t('nav.events') },
        { path: '/dashboard/promotions', label: t('nav.promotions') },
        { path: '/dashboard/qrcode', label: t('nav.qrcode'), roles: ['regular'] },
        { path: '/dashboard/redemption', label: t('nav.redemption'), roles: ['regular'] },
        { path: '/dashboard/transfer', label: t('nav.transfer'), roles: ['regular'] },
        { path: '/dashboard/users', label: t('nav.users') },
    ];

    // Use effectiveRole from InterfaceViewContext (which respects interface switching)
    const role = effectiveRole ?? user?.role ?? 'regular';
    const isRegular = role === 'regular';
    const isCashier = role === 'cashier';
    const isManagerOrSuperuser = role === 'manager' || role === 'superuser';
    // Cashiers and higher can see Users page (for account creation)
    const canViewUsers = isCashier || isManagerOrSuperuser;
    const name = user?.name ?? '';
    const email = user?.email ?? '';
    const birthday = user?.birthday ?? '';

    useEffect(() => {
        if (sidebarOpen) {
            // Hide hamburger immediately when sidebar opens
            setHamburgerVisible(false);
        } else {
            // Show hamburger after sidebar animation completes (0.3s)
            const timer = setTimeout(() => {
                setHamburgerVisible(true);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [sidebarOpen]);

    // Close account dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            const accountWrapper = event.target.closest('.account-button-wrapper');
            if (!accountWrapper && accountDropdownOpen) {
                setAccountDropdownOpen(false);
            }
        };

        if (accountDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [accountDropdownOpen]);

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const closeSidebar = () => {
        setSidebarOpen(false);
    };

    const handleLogout = async () => {
        // Import clearAuthToken dynamically to avoid circular dependencies
        const { clearAuthToken } = await import('../utils/api.js');
        clearAuthToken();
        
        // Call logout endpoint to clear httpOnly cookie
        try {
            await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
        } catch (err) {
            // Ignore errors - we're logging out anyway
        }
        
        // Dispatch custom event to notify UserContext
        window.dispatchEvent(new CustomEvent('tokenChange', { detail: { action: 'logout' } }));
        setAccountDropdownOpen(false);
        navigate('/login');
    };

    const goToAccountSettings = () => {
        setAccountDropdownOpen(false);
        navigate('/dashboard/account');
    };

    return (
        <div className="dashboard-layout">
            <header id="header">
                {hamburgerVisible && (
                    <button className="hamburger-menu" onClick={toggleSidebar} aria-label="Toggle menu">
                        <span className="hamburger-line"></span>
                        <span className="hamburger-line"></span>
                        <span className="hamburger-line"></span>
                    </button>
                )}
                <div className="logo">PointForge</div>
                <ul id="navbar">
                    {NAVIGATION_ITEMS.map((item) => {
                        const isActive = location.pathname === item.path ||
                                        (item.path === '/dashboard' && location.pathname === '/dashboard/');
                        
                        // Role-based filtering
                        if (!canViewUsers && item.path === '/dashboard/users') {
                            return null;
                        }
                        if (item.roles && !item.roles.includes(role)) {
                            return null;
                        }
                        
                        return (
                            <li key={item.path} className={`navbar-item ${isActive ? 'active' : ''}`}>
                                <Link to={item.path} onClick={closeSidebar}>{item.label}</Link>
                            </li>
                        );
                    })}
                </ul>
                <div className="account-button-wrapper">
                    <button
                        className={`account-button ${accountDropdownOpen ? 'active' : ''}`}
                        onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                        aria-label="Account menu"
                    >
                        {t('nav.account')}
                        <span className="dropdown-arrow">▼</span>
                    </button>
                    {accountDropdownOpen && (
                        <div className="account-dropdown">
                            <button
                                className="dropdown-item dropdown-item-account"
                                onClick={goToAccountSettings}
                            >
                                {t('nav.accountSettings')}
                            </button>
                            <button className="dropdown-item dropdown-item-button" onClick={handleLogout}>{t('nav.logout')}</button>
                        </div>
                    )}
                </div>
            </header>
            
            {/* Sidebar */}
            <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={closeSidebar}></div>
            <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">PointForge</div>
                    <button className="sidebar-close" onClick={closeSidebar} aria-label="Close menu">
                        ×
                    </button>
                </div>
                <ul className="sidebar-nav">
                    {NAVIGATION_ITEMS.map((item) => {
                        // Role-based filtering
                        if (!canViewUsers && item.path === '/dashboard/users') {
                            return null;
                        }
                        if (item.roles && !item.roles.includes(role)) {
                            return null;
                        }
                        return (
                            <li key={item.path} className="sidebar-item">
                                <Link to={item.path} onClick={closeSidebar}>{item.label}</Link>
                            </li>
                        );
                    })}
                    <li className="sidebar-item">
                        <Link to="/dashboard/account" onClick={closeSidebar}>{t('nav.account')}</Link>
                    </li>
                </ul>
            </div>
            
            <main>           
                <Outlet/>
            </main>
            <footer id="footer">
                <div className="footer-div">
                    {t('footer.copyright')}
                </div>
            </footer>
        </div>
    );
};

export default DashboardLayout;
