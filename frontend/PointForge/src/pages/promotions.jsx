/**
 * Promotions Page Component
 * 
 * This page displays a list of promotions with filtering, pagination, and management capabilities.
 * Key features:
 * - View all promotions with status, type, and advanced filters
 * - Search promotions by name
 * - Pagination to handle large lists
 * - For regular users: Add one-time promotions to wallet
 * - For managers: Create, edit, and delete promotions
 * - Click "View details" to open a popup modal with full promotion information
 */

import { useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import {
    Loading,
    Error,
    PromotionEditorModal,
    PromotionDetailModal,
    ConfirmModal
} from '../components';
import { authenticatedFetch } from '../utils/api.js';
import { formatDate } from '../utils/dateUtils.js';
import { buildPromotionPayload } from '../utils/promotionUtils.js';
import './promotions.css';

// Number of promotions to show per page for pagination
const PAGE_SIZE = 12;

function Promotions() {
    // Get current user from context to determine permissions and default filters
    const { user } = useContext(UserContext);
    const { t } = useLanguage();
    const isManager = user?.role === 'manager' || user?.role === 'superuser';
    const isRegular = user?.role === 'regular';

    const [searchParams, setSearchParams] = useSearchParams();

    // Filter state - initialized from URL params
    // Managers default to 'all' status to see everything; regular users default to 'active' only
    const defaultStatus = isManager ? 'all' : 'active';
    const statusFromUrl = searchParams.get('status');
    // Regular users always see 'active', even if URL has different status
    const initialStatus = isRegular ? 'active' : (statusFromUrl || defaultStatus);
    const [filters, setFilters] = useState({
        search: searchParams.get('name') || '',                    // Search by promotion name (URL uses 'name')
        status: initialStatus,  // Filter by status: active, upcoming, ended, or all
        type: searchParams.get('type') || 'all',                  // Filter by type: automatic, onetime, or all
        minSpendingMin: searchParams.get('minSpendingMin') || '',           // Minimum spending filter (lower bound)
        minSpendingMax: searchParams.get('minSpendingMax') || '',           // Minimum spending filter (upper bound)
        rateMin: searchParams.get('rateMin') || '',                   // Bonus rate filter (lower bound)
        rateMax: searchParams.get('rateMax') || '',                   // Bonus rate filter (upper bound)
        pointsMin: searchParams.get('pointsMin') || '',                 // Points filter (lower bound)
        pointsMax: searchParams.get('pointsMax') || '',                 // Points filter (upper bound)
        startAfter: searchParams.get('startAfter') || '',                // Filter promotions that start after this date
        startBefore: searchParams.get('startBefore') || '',               // Filter promotions that start before this date
        endAfter: searchParams.get('endAfter') || '',                  // Filter promotions that end after this date
        endBefore: searchParams.get('endBefore') || ''                  // Filter promotions that end before this date
    });
    
    // UI state management
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);  // Toggle advanced filter panel
    const [lastRole, setLastRole] = useState(user?.role);                   // Track role changes to reset filters
    const pageParam = searchParams.get('page');
    const [page, setPage] = useState(pageParam ? Math.max(1, parseInt(pageParam)) : 1);  // Current page number for pagination
    const [refreshKey, setRefreshKey] = useState(0);                        // Key to force re-fetch when promotions change
    const [data, setData] = useState({ results: [], count: 0 });            // Promotions data from API
    const [loading, setLoading] = useState(false);                          // Loading state for API calls
    const [error, setError] = useState('');                                  // Error message to display
    const [toast, setToast] = useState('');                                 // Success/notification message (for non-modal toasts)
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);        // Whether confirmation popup is open
    const [promotionToApply, setPromotionToApply] = useState(null);         // Promotion ID to apply after confirmation
    
    // Modal state for creating/editing promotions (managers only)
    const [modalState, setModalState] = useState({ open: false, mode: 'create', promotion: null });
    const [modalBusy, setModalBusy] = useState(false);                       // Prevents double-submission
    const [modalError, setModalError] = useState('');                        // Error from create/edit operation
    
    // State for adding promotions to wallet (regular users)
    const [applyingId, setApplyingId] = useState(null);                     // ID of promotion being added (for loading state)
    
    // State for promotion detail popup modal
    const [detailModalOpen, setDetailModalOpen] = useState(false);         // Whether detail popup is open
    const [selectedPromotionId, setSelectedPromotionId] = useState(null);   // ID of promotion to show in popup

    // Auto-hide toast messages after 4 seconds
    // This useEffect runs whenever 'toast' changes and sets a timer to clear it
    useEffect(() => {
        if(!toast) {
            return;  // No toast to hide
        }
        const timer = setTimeout(() => setToast(''), 4000);  // Clear toast after 4 seconds
        return () => clearTimeout(timer);  // Cleanup: cancel timer if component unmounts or toast changes
    }, [toast]);

    // Update URL params when filters or page change (bookmarkable URLs)
    useEffect(() => {
        const params = new URLSearchParams();
        if (filters.search.trim()) params.set('name', filters.search.trim());
        // Only include status in URL for managers (regular users always see 'active')
        if (isManager && filters.status && filters.status !== 'all') {
            params.set('status', filters.status);
        }
        if (filters.type && filters.type !== 'all') params.set('type', filters.type);
        if (filters.minSpendingMin) params.set('minSpendingMin', filters.minSpendingMin);
        if (filters.minSpendingMax) params.set('minSpendingMax', filters.minSpendingMax);
        if (filters.rateMin) params.set('rateMin', filters.rateMin);
        if (filters.rateMax) params.set('rateMax', filters.rateMax);
        if (filters.pointsMin) params.set('pointsMin', filters.pointsMin);
        if (filters.pointsMax) params.set('pointsMax', filters.pointsMax);
        if (filters.startAfter) params.set('startAfter', filters.startAfter);
        if (filters.startBefore) params.set('startBefore', filters.startBefore);
        if (filters.endAfter) params.set('endAfter', filters.endAfter);
        if (filters.endBefore) params.set('endBefore', filters.endBefore);
        if (page > 1) params.set('page', String(page));
        
        setSearchParams(params);
    }, [filters, page, isManager, setSearchParams]);

    // Reset status filter when user role changes
    // This ensures managers always see 'all' and regular users see 'active' when they log in
    useEffect(() => {
        if(!user?.role || user.role === lastRole) {
            return;  // No role change, do nothing
        }
        setFilters((prev) => ({
            ...prev,
            status: user.role === 'manager' || user.role === 'superuser' ? prev.status : 'active'
        }));
        setLastRole(user.role);  // Remember the new role
    }, [user?.role, lastRole]);

    // Main effect: Fetch promotions from API whenever filters, page, or refreshKey changes
    // This is the core data fetching logic that runs whenever user changes filters or page
    useEffect(() => {
        const controller = new AbortController();  // Allows canceling the request if component unmounts
        
        const fetchPromotions = async () => {
            setLoading(true);   // Show loading spinner
            setError('');       // Clear any previous errors
            try {
                // Build query parameters from filter state
                const params = new URLSearchParams();
                params.set('page', String(page));           // Current page number
                params.set('limit', String(PAGE_SIZE));     // How many per page
                
                // Add search filter if user typed something
                if(filters.search.trim()) {
                    params.set('name', filters.search.trim());
                }
                
                // Add status filter (including 'all' - this was fixed to work properly)
                // For regular users, always force 'active' status
                if(isRegular) {
                    params.set('status', 'active');
                } else if(filters.status) {
                    params.set('status', filters.status);
                }
                
                // Add type filter (only if not 'all')
                if(filters.type && filters.type !== 'all') {
                    params.set('type', filters.type);
                }
                
                // Add all advanced filter parameters if they have values
                ['minSpendingMin','minSpendingMax','rateMin','rateMax','pointsMin','pointsMax','startAfter','startBefore','endAfter','endBefore'].forEach((key) => {
                    if(filters[key]) {
                        params.set(key, filters[key]);
                    }
                });
                
                // Make authenticated API request
                const response = await authenticatedFetch(`/promotions?${params.toString()}`, {
                    signal: controller.signal  // Allows cancellation
                });
                
                // Handle expired session (authenticatedFetch handles logout automatically)
                if(response.status === 401) {
                    throw new Error('Session expired. Please log in again.');
                }
                
                // Check content type before parsing - prevents errors if server returns HTML instead of JSON
                const contentType = response.headers.get('content-type');
                let payload;
                if(contentType && contentType.includes('application/json')) {
                    payload = await response.json();  // Safe to parse as JSON
                } else {
                    const text = await response.text();
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }
                
                // Check if request was successful
                if(!response.ok) {
                    if(!response.ok) {
                        console.log(payload)
                        console.log(payload.message);
                        const errorMessage = payload.message;
                        setError(errorMessage);
                        throw new Error(errorMessage);
                    }
                }
                setData(payload);  // Save promotions data
            } catch (err) {
                if(err.name === 'AbortError') {
                    return;  // Request was cancelled (component unmounted), ignore error
                }
            } finally {
                setLoading(false);  // Always hide loading spinner
            }
        };
        fetchPromotions();
        
        // Cleanup: Cancel request if component unmounts or dependencies change
        return () => controller.abort();
    }, [filters, page, refreshKey]);  // Re-run when filters, page, or refreshKey changes

    // Calculate total pages for pagination
    const totalPages = Math.max(1, Math.ceil((data.count || 0) / PAGE_SIZE));

    // Update a single filter value and reset to page 1
    // Resetting to page 1 ensures user sees results from the beginning when filters change
    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value
        }));
        setPage(1);  // Reset to first page when filters change
    };

    // Open the create/edit promotion modal (managers only)
    const handleModalOpen = (mode, promotion = null) => {
        setModalState({ open: true, mode, promotion });  // 'create' or 'edit' mode
        setModalError('');  // Clear any previous errors
    };

    // Close the create/edit promotion modal
    const closeModal = () => {
        setModalState({ open: false, mode: 'create', promotion: null });
        setModalError('');
    };

    // Handle saving a new or edited promotion (managers only)
    const handleModalSubmit = async (values) => {
        setModalBusy(true);      // Disable form to prevent double-submission
        setModalError('');
        try {
            const payload = buildPromotionPayload(values);  // Convert form values to API format
            
            // For creation, ensure all required fields are present
            const isEditing = modalState.mode === 'edit' && modalState.promotion?.id;
            if(!isEditing) {
                const requiredFields = ['name', 'description', 'type', 'startTime', 'endTime'];
                const missingFields = requiredFields.filter(field => !payload[field] || payload[field] === '');
                if(missingFields.length > 0) {
                    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
                }
            }
            
            if(Object.keys(payload).length === 0) {
                throw new Error('Nothing to save');
            }
            
            // Determine endpoint and method
            const endpoint = isEditing ? `/promotions/${modalState.promotion.id}` : '/promotions';
            const method = isEditing ? 'PATCH' : 'POST';
            
            const response = await authenticatedFetch(endpoint, {
                method,
                body: JSON.stringify(payload)
            });
            
            // authenticatedFetch handles 401 automatically
            if(response.status === 401) {
                throw new Error('Session expired. Please log in again.');
            }
            
            // Parse response safely
            const contentType = response.headers.get('content-type');
            let body;
            if(contentType && contentType.includes('application/json')) {
                body = await response.json();
            } else {
                const text = await response.text();
                body = { message: text || 'Unknown error' };
            }
            
            if(!response.ok) {
                // Log the payload for debugging
                console.error('Failed to save promotion. Payload:', payload);
                console.error('Response:', body);
                setModalError(body.message);
                throw new Error(body.message || body.Message || `Unable to save promotion (${response.status})`);
            }
            
            // Success! Show toast and refresh the list
            setToast(isEditing ? t('promotions.promotionUpdated') : t('promotions.promotionCreated'));
            closeModal();
            setRefreshKey((key) => key + 1);  // Trigger re-fetch
            
            // If editing from detail modal, close it too
            if(isEditing && detailModalOpen) {
                setDetailModalOpen(false);
            }
        } catch (err) {
            console.log(err);
        } finally {
            setModalBusy(false);  // Re-enable form
        }
    };

    // Delete a promotion (managers only)
    const handleDeletePromotion = async (promotion) => {
        // Check if promotion has already started (safety check)
        if(!promotion.isUpcoming) {
            setError(t('promotions.cannotDelete'));
            return;
        }
        
        // Confirm deletion - this is destructive and can't be undone
        const confirmed = window.confirm(t('promotionDetail.deleteConfirm'));
        if(!confirmed) {
            return;  // User cancelled
        }
        try {
            const response = await authenticatedFetch(`/promotions/${promotion.id}`, {
                method: 'DELETE'
            });
            
            // authenticatedFetch handles 401 automatically
            if(response.status === 401) {
                throw new Error('Session expired. Please log in again.');
            }
            
            // DELETE returns 204 (No Content) on success, or JSON error on failure
            if(response.status !== 204) {
                const contentType = response.headers.get('content-type');
                let payload = {};
                if(contentType && contentType.includes('application/json')) {
                    payload = await response.json();
                } else {
                    const text = await response.text();
                    payload = text ? { message: text } : {};
                }
                // Extract error message from response
                const errorMessage = payload.message || payload.Message || `Unable to delete promotion (${response.status})`;
                throw new Error(errorMessage);
            }
            setToast(t('promotions.promotionDeleted'));
            setRefreshKey((key) => key + 1);  // Refresh the list
        } catch (err) {
            // Show error message to user
            const errorMsg = err.message || 'Unable to delete promotion';
            setError(errorMsg);
            console.error('Delete promotion error:', errorMsg);
        }
    };

    // Show confirmation modal before adding promotion to wallet
    const handleApplyPromotionClick = (promotionId) => {
        setPromotionToApply(promotionId);
        setConfirmModalOpen(true);
    };

    // Actually add the promotion to wallet after user confirms
    const handleApplyPromotion = async () => {
        if(!promotionToApply) {
            return;
        }
        const promotionId = promotionToApply;
        setConfirmModalOpen(false);  // Close confirmation modal
        setApplyingId(promotionId);  // Track which promotion is being added (for loading state)
        setToast('');
        try {
            const response = await authenticatedFetch(`/promotions/${promotionId}/use`, {
                method: 'POST'
            });
            
            // authenticatedFetch handles 401 automatically
            if(response.status === 401) {
                throw new Error('Session expired. Please log in again.');
            }
            
            // Parse response safely
            const contentType = response.headers.get('content-type');
            let payload;
            if(contentType && contentType.includes('application/json')) {
                payload = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
            
            if(!response.ok) {
                throw new Error(payload.message || 'Unable to add promotion to wallet');
            }
            // Refresh to show updated status (no success popup)
            setRefreshKey((key) => key + 1);
        } catch (err) {
            setError(err.message || 'Unable to add promotion to wallet');
        } finally {
            setApplyingId(null);  // Clear loading state
            setPromotionToApply(null);  // Clear promotion to apply
        }
    };

    // Render a single promotion card
    // This function creates the JSX for each promotion in the grid
    const renderPromotionCard = (promotion) => {
        // Determine CSS class for status badge (active, upcoming, or ended)
        const statusClass = `status-${promotion.status}`;
        
        // Format reward display: show rate as percentage or points
        const rateDisplay = promotion.rate ? `${Math.round(promotion.rate * 100)}% bonus` : null;
        const pointsDisplay = promotion.points ? `${promotion.points} pts` : null;
        const minSpend = promotion.minSpending ? `$${promotion.minSpending}` : t('promotions.noMinimum');
        
        // Determine if user can add this promotion to wallet (regular users + one-time promotions only)
        const canApply = isRegular && promotion.isOneTime;
        
        // Determine if add to wallet button should be disabled
        const applyDisabled = !promotion.usable || promotion.hasEnded || promotion.isUpcoming || promotion.alreadyUsed;

        return (
            <article key={promotion.id} className="promo-card">
                {/* Status and type badges at the top */}
                <div className="card-badges">
                    {/* Only show status badge for managers/superusers (regular users don't need it since all are active) */}
                    {isManager && (
                        <span className={`promo-badge ${statusClass}`}>{promotion.status}</span>
                    )}
                    <span className="promo-badge type">{promotion.isOneTime ? t('promotions.typeOneTime') : t('promotions.typeAutomatic')}</span>
                </div>
                
                {/* Promotion name and description */}
                <h3>{promotion.name}</h3>
                <p>{promotion.description}</p>
                
                {/* Promotion metadata: valid through date, minimum spending, reward */}
                <div className="promo-card-meta">
                    {promotion.endTime && <span>{t('promotions.validThrough')} {formatDate(promotion.endTime)}</span>}
                    <span>{t('promotions.minimumSpend')} {minSpend}</span>
                    <span>{t('promotions.reward')} {[rateDisplay, pointsDisplay].filter(Boolean).join(' · ') || t('common.seeDetails')}</span>
                </div>
                
                {/* Action buttons */}
                <div className="promo-card-actions">
                    {/* "View details" button - opens popup modal for all users */}
                    <button className="secondary-btn" onClick={() => {
                        setSelectedPromotionId(promotion.id);  // Remember which promotion
                        setDetailModalOpen(true);              // Open the popup
                    }}>
                        {t('promotions.viewDetails')}
                    </button>
                    
                    {/* "Add to wallet" button - only for regular users on usable one-time promotions */}
                    {canApply && promotion.usable && !applyDisabled && (
                        <button
                            className="primary-btn"
                            disabled={applyingId === promotion.id}  // Disable while adding
                            onClick={() => handleApplyPromotionClick(promotion.id)}
                        >
                            {applyingId === promotion.id ? t('promotions.adding') : promotion.alreadyUsed ? t('promotions.inWallet') : t('promotions.addToWallet')}
                        </button>
                    )}
                </div>
                
                {/* Manager-only actions: Edit and Delete buttons */}
                {isManager && (
                    <div className="promo-card-actions">
                        <button className="secondary-btn" onClick={() => handleModalOpen('edit', promotion)}>
                            Edit
                        </button>
                        {/* Only show delete button for promotions that haven't started yet */}
                        {promotion.isUpcoming && (
                            <button className="secondary-btn" onClick={() => handleDeletePromotion(promotion)}>
                                Delete
                            </button>
                        )}
                    </div>
                )}
            </article>
        );
    };

    return (
        <div className="promotions-page container">
            {/* Page header with title and "New promotion" button (managers only) */}
            <div className="page-header">
                <div className="promotions-section">
                    <h1>{t('promotions.title')}</h1>
                    <p>{t('promotions.subtitle')}</p>
                </div>
                <div className="page-actions">
                    {toast && <span className="toast">{toast}</span>}
                    {isManager && (
                        <button className="primary-btn" onClick={() => handleModalOpen('create')}>
                            {t('promotions.newPromotion')}
                        </button>
                    )}
                </div>
            </div>

            {/* Filter panel with basic and advanced filters */}
            <section className="filters-panel">
                {/* Basic filters row: search, status, type, and advanced filters toggle */}
                <div className="filters-row">
                    <input
                        type="search"
                        placeholder={t('promotions.searchPlaceholder')}
                        value={filters.search}
                        onChange={(event) => handleFilterChange('search', event.target.value)}
                    />
                    {/* Status filter: only show for managers/superusers */}
                    {isManager && (
                        <select value={filters.status} onChange={(event) => handleFilterChange('status', event.target.value)}>
                            <option value="active">{t('promotions.statusActive')}</option>
                            <option value="upcoming">{t('promotions.statusUpcoming')}</option>
                            <option value="ended">{t('promotions.statusEnded')}</option>
                            <option value="all">{t('promotions.statusAll')}</option>
                        </select>
                    )}
                    {/* Type filter: automatic, onetime, or all */}
                    <select value={filters.type} onChange={(event) => handleFilterChange('type', event.target.value)}>
                        <option value="all">{t('promotions.typeAll')}</option>
                        <option value="automatic">{t('promotions.typeAutomatic')}</option>
                        <option value="onetime">{t('promotions.typeOneTime')}</option>
                    </select>
                    {/* Toggle button to show/hide advanced filters */}
                    <button type="button" className="filters-toggle" onClick={() => setShowAdvancedFilters((prev) => !prev)}>
                        {showAdvancedFilters ? t('promotions.hideAdvancedFilters') : t('promotions.advancedFilters')}
                    </button>
                </div>
                
                {/* Advanced filters panel - shown when toggle is clicked */}
                {/* Organized in 5 columns with related filters stacked vertically */}
                {showAdvancedFilters && (
                    <div className="filters-advanced">
                        <div className="filters-advanced-grid">
                            {/* Column 1: Start date filters */}
                            <div className="filters-advanced-column">
                                <label>
                                    Start before
                                    <input
                                        type="datetime-local"
                                        value={filters.startBefore}
                                        onChange={(event) => handleFilterChange('startBefore', event.target.value)}
                                    />
                                </label>
                                <label>
                                    Start after
                                    <input
                                        type="datetime-local"
                                        value={filters.startAfter}
                                        onChange={(event) => handleFilterChange('startAfter', event.target.value)}
                                    />
                                </label>
                            </div>
                            {/* Column 2: End date filters */}
                            <div className="filters-advanced-column">
                                <label>
                                    End before
                                    <input
                                        type="datetime-local"
                                        value={filters.endBefore}
                                        onChange={(event) => handleFilterChange('endBefore', event.target.value)}
                                    />
                                </label>
                                <label>
                                    End after
                                    <input
                                        type="datetime-local"
                                        value={filters.endAfter}
                                        onChange={(event) => handleFilterChange('endAfter', event.target.value)}
                                    />
                                </label>
                            </div>
                            {/* Column 3: Minimum spending filters */}
                            <div className="filters-advanced-column">
                                <label>
                                    Min spend ≤
                                    <input
                                        type="number"
                                        value={filters.minSpendingMax}
                                        onChange={(event) => handleFilterChange('minSpendingMax', event.target.value)}
                                        placeholder="$0"
                                    />
                                </label>
                                <label>
                                    Min spend ≥
                                    <input
                                        type="number"
                                        value={filters.minSpendingMin}
                                        onChange={(event) => handleFilterChange('minSpendingMin', event.target.value)}
                                        placeholder="$0"
                                    />
                                </label>
                            </div>
                            {/* Column 4: Bonus rate filters */}
                            <div className="filters-advanced-column">
                                <label>
                                    Rate ≤ (%)
                                    <input
                                        type="number"
                                        value={filters.rateMax}
                                        onChange={(event) => handleFilterChange('rateMax', event.target.value)}
                                        step="0.1"
                                    />
                                </label>
                                <label>
                                    Rate ≥ (%)
                                    <input
                                        type="number"
                                        value={filters.rateMin}
                                        onChange={(event) => handleFilterChange('rateMin', event.target.value)}
                                        step="0.1"
                                    />
                                </label>
                            </div>
                            {/* Column 5: Points filters */}
                            <div className="filters-advanced-column">
                                <label>
                                    Points ≤
                                    <input
                                        type="number"
                                        value={filters.pointsMax}
                                        onChange={(event) => handleFilterChange('pointsMax', event.target.value)}
                                    />
                                </label>
                                <label>
                                    Points ≥
                                    <input
                                        type="number"
                                        value={filters.pointsMin}
                                        onChange={(event) => handleFilterChange('pointsMin', event.target.value)}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Error message display */}
            {error && <Error error={error} />}
            
            {/* Main content area: loading, empty state, or promotions grid */}
            {loading ? (
                <Loading message={t('promotions.loading')} />
            ) : data.results.length === 0 ? (
                <div className="promotions-empty">
                    <p>{t('promotions.noMatches')}</p>
                </div>
            ) : (
                <section className="promotions-grid">
                    {/* Render each promotion as a card in a 4-column grid */}
                    {data.results.map(renderPromotionCard)}
                </section>
            )}

            {/* Pagination controls - only show if more than one page */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button type="button" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                        Previous
                    </button>
                    <span className="results-meta">Page {page} of {totalPages}</span>
                    <button
                        type="button"
                        disabled={page === totalPages}
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Modal for creating/editing promotions (managers only) */}
            <PromotionEditorModal
                isOpen={modalState.open}
                mode={modalState.mode}
                initialValues={modalState.promotion}
                busy={modalBusy}
                error={modalError}
                onClose={closeModal}
                onSubmit={handleModalSubmit}
            />

            {/* Modal for viewing promotion details (all users) */}
            {/* Opens when user clicks "View details" button on any promotion card */}
            <PromotionDetailModal
                promotionId={selectedPromotionId}
                isOpen={detailModalOpen}
                onClose={() => {
                    setDetailModalOpen(false);
                    setSelectedPromotionId(null);
                }}
                onPromotionUpdated={() => setRefreshKey((key) => key + 1)}
            />


            {/* Confirmation modal - asks user to confirm before adding promotion to wallet */}
            <ConfirmModal
                isOpen={confirmModalOpen}
                title="Add to Wallet?"
                message="Are you sure you want to add this promotion to your wallet?"
                confirmText="Add to Wallet"
                cancelText="Cancel"
                onConfirm={handleApplyPromotion}
                onCancel={() => {
                    setConfirmModalOpen(false);
                    setPromotionToApply(null);
                }}
            />
        </div>
    );
}
 
export default Promotions;
