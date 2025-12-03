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

                // Handle expired session
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.dispatchEvent(new CustomEvent('tokenChange', { detail: { action: 'logout' } }));
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

        // Only fetch if user is manager or superuser
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


    // Render a single user card
    const renderUserCard = (userItem) => {
        const roleColors = {
            regular: '#4CAF50',
            cashier: '#2196F3',
            manager: '#FF9800',
            superuser: '#9C27B0'
        };

        return (
            <article key={userItem.id} className="user-card">
                {/* Badges at the top */}
                <div className="card-badges">
                    <span
                        className="user-badge role-badge"
                        style={{ backgroundColor: roleColors[userItem.role] || '#666' }}
                    >
                        {userItem.role}
                    </span>
                    {userItem.verified ? (
                        <span className="user-badge status-badge--verified">Verified</span>
                    ) : (
                        <span className="user-badge status-badge--unverified">Unverified</span>
                    )}
                    {userItem.suspicious && (
                        <span className="user-badge status-badge--suspicious">Suspicious</span>
                    )}
                </div>

                {/* User name and UTORid */}
                <h3>{userItem.name || userItem.utorid}</h3>
                <p>{userItem.utorid}</p>

                {/* User metadata: points */}
                <div className="user-card-meta">
                    <span>Points: {userItem.points?.toLocaleString() || 0}</span>
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
                        View Details
                    </button>
                </div>
            </article>
        );
    };

    // If not manager, show access denied
    if (!isManager) {
        return (
            <div className="users-page container">
                <Error error="Access denied. Only managers and superusers can view this page." />
            </div>
        );
    }

    return (
        <div className="users-page container">
            {/* Page header */}
            <div className="page-header">
                <div className="users-section">
                    <h1>User Management</h1>
                    <p>View and manage all users in the system</p>
                </div>
                <div className="page-actions">
                    {toast && <span className="toast">{toast}</span>}
                </div>
            </div>

            {/* Filter panel */}
            <section className="filters-panel">
                <div className="filters-row">
                    <input
                        type="search"
                        placeholder="Search by name"
                        value={filters.name}
                        onChange={(e) => handleFilterChange('name', e.target.value)}
                    />
                    <select
                        value={filters.role}
                        onChange={(e) => handleFilterChange('role', e.target.value)}
                    >
                        <option value="">All Roles</option>
                        <option value="regular">Regular</option>
                        <option value="cashier">Cashier</option>
                        <option value="manager">Manager</option>
                        <option value="superuser">Superuser</option>
                    </select>
                    <select
                        value={filters.verified}
                        onChange={(e) => handleFilterChange('verified', e.target.value)}
                    >
                        <option value="">All Verification Status</option>
                        <option value="true">Verified</option>
                        <option value="false">Not Verified</option>
                    </select>
                    <select
                        value={filters.activated}
                        onChange={(e) => handleFilterChange('activated', e.target.value)}
                    >
                        <option value="">All Activation Status</option>
                        <option value="true">Activated</option>
                        <option value="false">Not Activated</option>
                    </select>
                    <button type="button" className="filters-toggle" onClick={clearFilters}>
                        Clear Filters
                    </button>
                </div>
            </section>

            {/* Error message display */}
            {error && <Error error={error} />}

            {/* Main content area: loading, empty state, or users grid */}
            {loading ? (
                <Loading message="Loading users..." />
            ) : data.results.length === 0 ? (
                <div className="users-empty">
                    <EmptyState message="No users found matching your filters" />
                </div>
            ) : (
                <section className="users-grid">
                    {data.results.map(renderUserCard)}
                </section>
            )}

            {/* Pagination controls */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button
                        type="button"
                        disabled={page === 1}
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                        Previous
                    </button>
                    <span className="results-meta">
                        Page {page} of {totalPages} ({data.count} total users)
                    </span>
                    <button
                        type="button"
                        disabled={page === totalPages}
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                        Next
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
        </div>
    );
}

export default Users;
