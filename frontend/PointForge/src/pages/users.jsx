/**
 * Users Page Component
 *
 * This page displays a list of users with filtering, pagination, and management capabilities.
 * Key features:
 * - View all users with filtering by name, role, verified, and activated status
 * - Pagination to handle large lists
 * - For managers: Verify users, mark as suspicious, and change roles
 * - Click on user to view/edit details
 */

import { useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import {
    Loading,
    Error,
    EmptyState,
    UserDetailModal
} from '../components';
import { authenticatedFetch } from '../utils/api.js';
import './users.css';

// Number of users to show per page for pagination
const PAGE_SIZE = 12;

function Users() {
    // Get current user from context to determine permissions
    const { user } = useContext(UserContext);
    const { t } = useLanguage();
    const isManager = user?.role === 'manager' || user?.role === 'superuser';
    const isCashier = user?.role === 'cashier';
    const canCreateAccounts = isCashier || isManager; // Cashiers+ can create accounts

    const [searchParams, setSearchParams] = useSearchParams();

    // Filter state - initialized from URL params
    const [filters, setFilters] = useState({
        name: searchParams.get('name') || '',
        role: searchParams.get('role') || '',
        verified: searchParams.get('verified') || '',
        activated: searchParams.get('activated') || ''
    });

    // UI state management
    const pageParam = searchParams.get('page');
    const [page, setPage] = useState(pageParam ? Math.max(1, parseInt(pageParam)) : 1);
    const [refreshKey, setRefreshKey] = useState(0);
    const [data, setData] = useState({ results: [], count: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [createAccountModalOpen, setCreateAccountModalOpen] = useState(false);
    const [createAccountForm, setCreateAccountForm] = useState({
        utorid: '',
        name: '',
        email: '',
        password: '',
        role: 'regular'
    });
    const [createAccountError, setCreateAccountError] = useState('');
    const [createAccountLoading, setCreateAccountLoading] = useState(false);

    // Auto-hide toast messages after 4 seconds
    useEffect(() => {
        if (!toast) {
            return;
        }
        const timer = setTimeout(() => setToast(''), 4000);
        return () => clearTimeout(timer);
    }, [toast]);

    // Update URL params when filters or page change (bookmarkable URLs)
    useEffect(() => {
        const params = new URLSearchParams();
        if (filters.name.trim()) params.set('name', filters.name.trim());
        if (filters.role) params.set('role', filters.role);
        if (filters.verified === 'true' || filters.verified === 'false') params.set('verified', filters.verified);
        if (filters.activated === 'true' || filters.activated === 'false') params.set('activated', filters.activated);
        if (page > 1) params.set('page', String(page));
        
        setSearchParams(params);
    }, [filters, page, setSearchParams]);

    // Main effect: Fetch users from API whenever filters, page, or refreshKey changes
    useEffect(() => {
        const controller = new AbortController();

        const fetchUsers = async () => {
            setLoading(true);
            setError('');
            try {
                // Build query parameters from filter state
                const params = new URLSearchParams();
                params.set('page', String(page));
                params.set('limit', String(PAGE_SIZE));

                // Add search filter if user typed something
                if (filters.name.trim()) {
                    params.set('name', filters.name.trim());
                }

                // Add role filter
                if (filters.role) {
                    params.set('role', filters.role);
                }

                // Add verified filter
                if (filters.verified === 'true' || filters.verified === 'false') {
                    params.set('verified', filters.verified);
                }

                // Add activated filter
                if (filters.activated === 'true' || filters.activated === 'false') {
                    params.set('activated', filters.activated);
                }

                // Make authenticated API request
                const response = await authenticatedFetch(`/users?${params.toString()}`, {
                    signal: controller.signal
                });

                // Handle expired session (authenticatedFetch handles logout automatically)
                if (response.status === 401) {
                    throw new Error('Session expired. Please log in again.');
                }

                // Check content type before parsing
                const contentType = response.headers.get('content-type');
                let payload;
                if (contentType && contentType.includes('application/json')) {
                    payload = await response.json();
                } else {
                    const text = await response.text();
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }

                // Check if request was successful
                if (!response.ok) {
                    const errorMessage = payload.message || payload.Message || 'Unable to fetch users';
                    setError(errorMessage);
                    throw new Error(errorMessage);
                }
                setData(payload);
            } catch (err) {
                if (err.name === 'AbortError') {
                    return;
                }
                if (!error) {
                    setError(err.message || 'Unable to fetch users');
                }
            } finally {
                setLoading(false);
            }
        };

        // Only fetch if user is manager or superuser (cashiers can create but not view all)
        if (isManager) {
            fetchUsers();
        }

        // Cleanup: Cancel request if component unmounts or dependencies change
        return () => controller.abort();
    }, [filters, page, refreshKey, isManager]);

    // Calculate total pages for pagination
    const totalPages = Math.max(1, Math.ceil((data.count || 0) / PAGE_SIZE));

    const clearFilters = () => {
        setFilters({
            name: '',
            role: '',
            verified: '',
            activated: ''
        });
        setPage(1);
        // URL will be updated by the useEffect above
    };

    // Update a single filter value and reset to page 1
    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value
        }));
        setPage(1);
    };

    // Handle creating a new account
    const handleCreateAccount = async (e) => {
        e.preventDefault();
        setCreateAccountError('');
        setCreateAccountLoading(true);

        try {
            const response = await authenticatedFetch('/users/create', {
                method: 'POST',
                body: JSON.stringify(createAccountForm)
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.Message || data.message || 'Failed to create account');
            }

            setToast(t('users.accountCreated'));
            setCreateAccountModalOpen(false);
            setCreateAccountForm({
                utorid: '',
                name: '',
                email: '',
                password: '',
                role: 'regular'
            });
            
            // Refresh user list if manager
            if (isManager) {
                setRefreshKey((key) => key + 1);
            }
        } catch (err) {
            setCreateAccountError(err.message || 'Failed to create account');
        } finally {
            setCreateAccountLoading(false);
        }
    };


    // Render a single user card
    const renderUserCard = (userItem) => {
        const roleColors = {
            regular: '#4CAF50',
            cashier: '#2196F3',
            manager: '#FF9800',
            superuser: '#9C27B0'
        };
        
        // Translate role
        const getRoleLabel = (role) => {
            switch (role) {
                case 'regular':
                    return t('users.roleRegular');
                case 'cashier':
                    return t('users.roleCashier');
                case 'manager':
                    return t('users.roleManager');
                case 'superuser':
                    return t('users.roleSuperuser');
                default:
                    return role;
            }
        };

        return (
            <article key={userItem.id} className="user-card">
                {/* Badges at the top */}
                <div className="card-badges">
                    <span
                        className="user-badge role-badge"
                        style={{ backgroundColor: roleColors[userItem.role] || '#666' }}
                    >
                        {getRoleLabel(userItem.role)}
                    </span>
                    {userItem.verified ? (
                        <span className="user-badge status-badge--verified">{t('users.verified')}</span>
                    ) : (
                        <span className="user-badge status-badge--unverified">{t('users.notVerified')}</span>
                    )}
                    {userItem.suspicious && (
                        <span className="user-badge status-badge--suspicious">{t('transactionCard.suspicious')}</span>
                    )}
                </div>

                {/* User name and UTORid */}
                <h3>{userItem.name || userItem.utorid}</h3>
                <p>{userItem.utorid}</p>

                {/* User metadata: points */}
                <div className="user-card-meta">
                    <span>{t('users.points')} {userItem.points?.toLocaleString() || 0}</span>
                </div>

                {/* Action buttons */}
                <div className="user-card-actions">
                    <button
                        className="secondary-btn"
                        onClick={() => {
                            setSelectedUserId(userItem.id);
                            setDetailModalOpen(true);
                        }}
                    >
                        {t('users.viewDetails')}
                    </button>
                </div>
            </article>
        );
    };

    // If not cashier or manager, show access denied
    if (!canCreateAccounts) {
        return (
            <div className="users-page container">
                <Error error={t('users.accessDenied')} />
            </div>
        );
    }

    return (
        <div className="users-page container">
            {/* Page header */}
            <div className="page-header">
                <div className="users-section">
                    <h1>{t('users.title')}</h1>
                    <p>{t('users.subtitle')}</p>
                </div>
                <div className="page-actions">
                    {toast && <span className="toast">{toast}</span>}
                    {canCreateAccounts && (
                        <button className="primary-btn" onClick={() => setCreateAccountModalOpen(true)}>
                            {t('users.createAccount')}
                        </button>
                    )}
                </div>
            </div>

            {/* Filter panel */}
            <section className="filters-panel">
                <div className="filters-row">
                    <input
                        type="search"
                        placeholder={t('users.searchPlaceholder')}
                        value={filters.name}
                        onChange={(e) => handleFilterChange('name', e.target.value)}
                    />
                    <select
                        value={filters.role}
                        onChange={(e) => handleFilterChange('role', e.target.value)}
                    >
                        <option value="">{t('users.allRoles')}</option>
                        <option value="regular">{t('users.roleRegular')}</option>
                        <option value="cashier">{t('users.roleCashier')}</option>
                        <option value="manager">{t('users.roleManager')}</option>
                        <option value="superuser">{t('users.roleSuperuser')}</option>
                    </select>
                    <select
                        value={filters.verified}
                        onChange={(e) => handleFilterChange('verified', e.target.value)}
                    >
                        <option value="">{t('users.allVerificationStatus')}</option>
                        <option value="true">{t('users.verified')}</option>
                        <option value="false">{t('users.notVerified')}</option>
                    </select>
                    <select
                        value={filters.activated}
                        onChange={(e) => handleFilterChange('activated', e.target.value)}
                    >
                        <option value="">{t('users.allActivationStatus')}</option>
                        <option value="true">{t('users.activated')}</option>
                        <option value="false">{t('users.notActivated')}</option>
                    </select>
                    <button type="button" className="filters-toggle" onClick={clearFilters}>
                        {t('users.clearFilters')}
                    </button>
                </div>
            </section>

            {/* Error message display */}
            {error && <Error error={error} />}

            {/* Show message for cashiers who can't view all users */}
            {isCashier && !isManager && (
                <div className="users-info-message">
                    <p>{t('users.cashierInfo')}</p>
                    <p>{t('users.cashierInfo2')}</p>
                </div>
            )}

            {/* Main content area: loading, empty state, or users grid */}
            {isManager && (
                <>
                    {loading ? (
                        <Loading message={t('users.loading')} />
                    ) : data.results.length === 0 ? (
                        <div className="users-empty">
                            <EmptyState message={t('users.noMatches')} />
                        </div>
                    ) : (
                        <section className="users-grid">
                            {data.results.map(renderUserCard)}
                        </section>
                    )}
                </>
            )}

            {/* Pagination controls */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button
                        type="button"
                        disabled={page === 1}
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                        {t('pagination.previous')}
                    </button>
                    <span className="results-meta">
                        {t('pagination.page')} {page} {t('pagination.of')} {totalPages} ({data.count} {t('pagination.totalUsers')})
                    </span>
                    <button
                        type="button"
                        disabled={page === totalPages}
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                        {t('pagination.next')}
                    </button>
                </div>
            )}

            {/* User Detail Modal */}
            <UserDetailModal
                userId={selectedUserId}
                isOpen={detailModalOpen}
                onClose={() => {
                    setDetailModalOpen(false);
                    setSelectedUserId(null);
                }}
                onUserUpdated={() => setRefreshKey((key) => key + 1)}
            />

            {/* Create Account Modal */}
            {createAccountModalOpen && (
                <div className="modal-overlay" onClick={() => setCreateAccountModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{t('users.createNewAccount')}</h2>
                            <button className="modal-close" onClick={() => setCreateAccountModalOpen(false)}>×</button>
                        </div>
                        {createAccountError && <Error error={createAccountError} />}
                        <form onSubmit={handleCreateAccount} className="account-form">
                            <div className="account-form-group">
                                <label htmlFor="create-utorid">
                                    {t('users.utorid')} <span className="required">{t('users.required')}</span>
                                </label>
                                <input
                                    type="text"
                                    id="create-utorid"
                                    value={createAccountForm.utorid}
                                    onChange={(e) => setCreateAccountForm({ ...createAccountForm, utorid: e.target.value })}
                                    required
                                    minLength={7}
                                    maxLength={8}
                                    pattern="[a-zA-Z0-9]+"
                                    disabled={createAccountLoading}
                                />
                                <small>{t('users.alphanumeric')}</small>
                            </div>
                            <div className="account-form-group">
                                <label htmlFor="create-name">
                                    {t('users.name')} <span className="required">{t('users.required')}</span>
                                </label>
                                <input
                                    type="text"
                                    id="create-name"
                                    value={createAccountForm.name}
                                    onChange={(e) => setCreateAccountForm({ ...createAccountForm, name: e.target.value })}
                                    required
                                    maxLength={50}
                                    disabled={createAccountLoading}
                                />
                            </div>
                            <div className="account-form-group">
                                <label htmlFor="create-email">
                                    {t('users.email')} <span className="required">{t('users.required')}</span>
                                </label>
                                <input
                                    type="email"
                                    id="create-email"
                                    value={createAccountForm.email}
                                    onChange={(e) => setCreateAccountForm({ ...createAccountForm, email: e.target.value })}
                                    required
                                    pattern=".+@mail\.utoronto\.ca"
                                    disabled={createAccountLoading}
                                />
                                <small>{t('users.emailHint')}</small>
                            </div>
                            <div className="account-form-group">
                                <label htmlFor="create-password">
                                    {t('users.password')} <span className="required">{t('users.required')}</span>
                                </label>
                                <input
                                    type="password"
                                    id="create-password"
                                    value={createAccountForm.password}
                                    onChange={(e) => setCreateAccountForm({ ...createAccountForm, password: e.target.value })}
                                    required
                                    minLength={8}
                                    disabled={createAccountLoading}
                                />
                                <small>{t('users.passwordHint')}</small>
                            </div>
                            {isManager && (
                                <div className="account-form-group">
                                    <label htmlFor="create-role">
                                        {t('users.role')}
                                    </label>
                                    <select
                                        id="create-role"
                                        value={createAccountForm.role}
                                        onChange={(e) => setCreateAccountForm({ ...createAccountForm, role: e.target.value })}
                                        disabled={createAccountLoading}
                                    >
                                        <option value="regular">{t('users.roleRegular')}</option>
                                        {isManager && (
                                            <>
                                                <option value="cashier">{t('users.roleCashier')}</option>
                                                {user?.role === 'superuser' && (
                                                    <>
                                                        <option value="manager">{t('users.roleManager')}</option>
                                                        <option value="superuser">{t('users.roleSuperuser')}</option>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </select>
                                </div>
                            )}
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => setCreateAccountModalOpen(false)}
                                    disabled={createAccountLoading}
                                >
                                    {t('users.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="primary-btn"
                                    disabled={createAccountLoading}
                                >
                                    {createAccountLoading ? t('users.creating') : t('users.createAccount')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Users;
