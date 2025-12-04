/**
 * Transactions Page Component
 * 
 * This page displays a list of transactions with filtering, pagination, and sorting.
 * Key features:
 * - Regular users: View their own transactions
 * - Managers: View all transactions
 * - Filter by type, amount, promotion, and more (for managers)
 * - Pagination and sorting
 * - Bookmarkable URLs with query parameters
 */

import { useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import {
    Loading,
    Error,
    Transaction,
    TransactionDetailModal
} from '../components';
import { authenticatedFetch } from '../utils/api.js';
import './transactions.css';

// Number of transactions to show per page
const PAGE_SIZE = 10;

function Transactions() {
    const { user } = useContext(UserContext);
    const { t } = useLanguage();
    const isManager = user?.role === 'manager' || user?.role === 'superuser';
    
    const [searchParams, setSearchParams] = useSearchParams();
    
    // Filter state - initialized from URL params
    const [filters, setFilters] = useState({
        type: searchParams.get('type') || 'all',
        pointsMin: searchParams.get('pointsMin') || '',
        pointsMax: searchParams.get('pointsMax') || '',
        spentMin: searchParams.get('spentMin') || '',
        spentMax: searchParams.get('spentMax') || '',
        promotionId: searchParams.get('promotionId') || '',
        // Manager-only filters
        name: searchParams.get('name') || '',
        createdBy: searchParams.get('createdBy') || '',
        suspicious: searchParams.get('suspicious') || 'all',
    });
    
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    
    const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'id');
    const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
    const pageParam = searchParams.get('page');
    const [page, setPage] = useState(pageParam ? Math.max(1, parseInt(pageParam)) : 1);
    const [data, setData] = useState({ results: [], count: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [transactionModalOpen, setTransactionModalOpen] = useState(false);
    const [selectedTransactionId, setSelectedTransactionId] = useState(null);

    // Update URL params when filters or page change (bookmarkable URLs)
    useEffect(() => {
        const params = new URLSearchParams();
        if (filters.type !== 'all') params.set('type', filters.type);
        if (filters.pointsMin) params.set('pointsMin', filters.pointsMin);
        if (filters.pointsMax) params.set('pointsMax', filters.pointsMax);
        if (filters.spentMin) params.set('spentMin', filters.spentMin);
        if (filters.spentMax) params.set('spentMax', filters.spentMax);
        if (filters.promotionId) params.set('promotionId', filters.promotionId);
        if (isManager) {
            if (filters.name) params.set('name', filters.name);
            if (filters.createdBy) params.set('createdBy', filters.createdBy);
            if (filters.suspicious !== 'all') params.set('suspicious', filters.suspicious);
        }
        if (sortBy !== 'id') params.set('sortBy', sortBy);
        if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
        if (page > 1) params.set('page', String(page));
        
        setSearchParams(params);
    }, [filters, sortBy, sortOrder, page, isManager, setSearchParams]);

    // Fetch transactions from API
    useEffect(() => {
        const controller = new AbortController();
        
        const fetchTransactions = async () => {
            setLoading(true);
            setError('');
            
            // Check if filters are active (needs client-side filtering)
            const hasClientSideFilters = filters.pointsMin || filters.pointsMax || filters.spentMin || filters.spentMax;
            
            // When sorting by date, we need to fetch all results and sort client-side
            // because the backend may not support date sorting correctly
            const needsClientSideSorting = sortBy === 'date';
            
            try {
                const params = new URLSearchParams();
                // When client-side filters or date sorting are active, fetch all results
                // Otherwise, use server-side pagination
                if (hasClientSideFilters || needsClientSideSorting) {
                    params.set('page', '1');
                    params.set('limit', '10000'); // Fetch a large number for client-side filtering/sorting
                } else {
                    params.set('page', String(page));
                    params.set('limit', String(PAGE_SIZE));
                }
                
                // Add filters
                if (filters.type !== 'all') {
                    params.set('type', filters.type);
                }
                if (filters.promotionId) {
                    params.set('promotionId', filters.promotionId);
                }
                
                // Manager-only filters
                if (isManager) {
                    if (filters.name) {
                        params.set('name', filters.name);
                    }
                    if (filters.createdBy) {
                        params.set('createdBy', filters.createdBy);
                    }
                    if (filters.suspicious !== 'all') {
                        params.set('suspicious', filters.suspicious === 'true' ? 'true' : 'false');
                    }
                }
                
                // Add sorting parameters to API request
                if (sortBy && sortBy !== 'none') {
                    params.set('sortBy', sortBy);
                    params.set('sortOrder', sortOrder);
                }
                
                // Determine endpoint based on user role
                const endpoint = isManager ? `/transactions?${params.toString()}` : `/users/me/transactions?${params.toString()}`;
                
                const response = await authenticatedFetch(endpoint, {
                    signal: controller.signal
                });
                
                // 401 is now handled globally in authenticatedFetch, but check here to show appropriate message
                if (response.status === 401) {
                    // User will be automatically logged out by authenticatedFetch
                    throw new Error('Session expired. Please log in again.');
                }
                
                const contentType = response.headers.get('content-type');
                let payload;
                if (contentType && contentType.includes('application/json')) {
                    payload = await response.json();
                } else {
                    const text = await response.text();
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }
                
                if (!response.ok) {
                    throw new Error(payload.message || payload.Message || t('error.unableToLoadTransactions'));
                }
                
                // Client-side filtering for points and spent amounts
                let filteredResults = [...payload.results];
                
                if (filters.pointsMin || filters.pointsMax || filters.spentMin || filters.spentMax) {
                    filteredResults = filteredResults.filter(transaction => {
                        // Filter by points amount
                        const transactionPoints = transaction.amount || transaction.sent || transaction.awarded || Math.abs(transaction.redeemed || 0) || 0;
                        const minPoints = filters.pointsMin ? parseFloat(filters.pointsMin) : null;
                        const maxPoints = filters.pointsMax ? parseFloat(filters.pointsMax) : null;
                        
                        if (minPoints !== null && transactionPoints < minPoints) {
                            return false;
                        }
                        if (maxPoints !== null && transactionPoints > maxPoints) {
                            return false;
                        }
                        
                        // Filter by spent amount (only for purchase transactions)
                        if (transaction.type === 'purchase' && transaction.spent != null) {
                            const spentValue = parseFloat(transaction.spent);
                            const minSpent = filters.spentMin ? parseFloat(filters.spentMin) : null;
                            const maxSpent = filters.spentMax ? parseFloat(filters.spentMax) : null;
                            
                            if (minSpent !== null && spentValue < minSpent) {
                                return false;
                            }
                            if (maxSpent !== null && spentValue > maxSpent) {
                                return false;
                            }
                        } else if (filters.spentMin || filters.spentMax) {
                            // If spent filters are set but transaction is not a purchase, exclude it
                            return false;
                        }
                        
                        return true;
                    });
                }
                
                // Always do client-side sorting to ensure date sorting works correctly
                // (Backend may not support all sort options, so we handle it client-side)
                let sortedResults = [...filteredResults];
                if (sortBy && sortBy !== 'none') {
                    sortedResults.sort((a, b) => {
                        let aVal, bVal;
                        
                        switch (sortBy) {
                            case 'type':
                                aVal = a.type || '';
                                bVal = b.type || '';
                                break;
                            case 'amount':
                                aVal = a.amount || a.sent || a.awarded || Math.abs(a.redeemed || 0) || 0;
                                bVal = b.amount || b.sent || b.awarded || Math.abs(b.redeemed || 0) || 0;
                                break;
                            case 'date':
                                // Sort by transaction date - ensure proper parsing
                                // Handle both ISO string and Date object formats
                                if (a.date) {
                                    const aDate = new Date(a.date);
                                    aVal = isNaN(aDate.getTime()) ? 0 : aDate.getTime();
                                } else {
                                    aVal = 0;
                                }
                                if (b.date) {
                                    const bDate = new Date(b.date);
                                    bVal = isNaN(bDate.getTime()) ? 0 : bDate.getTime();
                                } else {
                                    bVal = 0;
                                }
                                break;
                            case 'id':
                            default:
                                aVal = a.id || 0;
                                bVal = b.id || 0;
                                break;
                        }
                        
                        if (typeof aVal === 'string') {
                            return sortOrder === 'asc' 
                                ? aVal.localeCompare(bVal)
                                : bVal.localeCompare(aVal);
                        } else {
                            return sortOrder === 'asc' 
                                ? aVal - bVal
                                : bVal - aVal;
                        }
                    });
                }
                
                // Client-side pagination (when client-side filters or date sorting are applied, otherwise use server-side paginated results)
                if (hasClientSideFilters || needsClientSideSorting) {
                    const totalCount = sortedResults.length;
                    const startIndex = (page - 1) * PAGE_SIZE;
                    const endIndex = startIndex + PAGE_SIZE;
                    const paginatedResults = sortedResults.slice(startIndex, endIndex);
                    setData({ results: paginatedResults, count: totalCount });
                } else {
                    // Use server-side paginated results (no client-side pagination needed)
                    setData({ results: sortedResults, count: payload.count });
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    return;
                }
                // If session expired, don't show error - user is being logged out
                if (err.message === 'Session expired' || err.message.includes('Session expired')) {
                    // User is being logged out by authenticatedFetch, just return
                    return;
                }
                setError(err.message || t('error.unableToLoadTransactions'));
            } finally {
                setLoading(false);
            }
        };
        
        fetchTransactions();
        return () => controller.abort();
    }, [filters, page, isManager, sortBy, sortOrder]);

    const totalPages = Math.max(1, Math.ceil((data.count || 0) / PAGE_SIZE));

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
        setPage(1);
    };

    const handleSortChange = (newSortBy) => {
        if (sortBy === newSortBy) {
            // Toggle sort order if clicking the same column
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(newSortBy);
            setSortOrder('desc');
        }
        setPage(1);
    };

    return (
        <div className="transactions-page container">
            <div className="page-header">
                <div className="transactions-section">
                    <h1>{t('transactions.title')}</h1>
                    <p>{isManager ? t('transactions.subtitleManager') : t('transactions.subtitleRegular')}</p>
                </div>
            </div>

            {/* Filter and Sort panel */}
            <section className="filters-panel">
                {/* Basic filters row: Transaction Type, Sort by, and Advanced Filters toggle */}
                <div className="filters-row">
                    <label>
                        {t('transactions.transactionType')}
                        <select 
                            value={filters.type} 
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                        >
                            <option value="all">{t('transactions.allTypes')}</option>
                            <option value="purchase">{t('transactions.typePurchase')}</option>
                            <option value="redemption">{t('transactions.typeRedemption')}</option>
                            <option value="transfer">{t('transactions.typeTransfer')}</option>
                            <option value="event">{t('transactions.typeEvent')}</option>
                            <option value="adjustment">{t('transactions.typeAdjustment')}</option>
                        </select>
                    </label>
                    <label>
                        {t('transactions.sortBy')}
                        <select 
                            value={`${sortBy}-${sortOrder}`} 
                            onChange={(e) => {
                                const [newSortBy, newSortOrder] = e.target.value.split('-');
                                setSortBy(newSortBy);
                                setSortOrder(newSortOrder);
                                setPage(1);
                            }}
                        >
                            <option value="id-desc">{t('transactions.sortIdDesc')}</option>
                            <option value="id-asc">{t('transactions.sortIdAsc')}</option>
                            <option value="date-desc">{t('transactions.sortDateDesc')}</option>
                            <option value="date-asc">{t('transactions.sortDateAsc')}</option>
                            <option value="type-desc">{t('transactions.sortTypeDesc')}</option>
                            <option value="type-asc">{t('transactions.sortTypeAsc')}</option>
                            <option value="amount-desc">{t('transactions.sortAmountDesc')}</option>
                            <option value="amount-asc">{t('transactions.sortAmountAsc')}</option>
                        </select>
                    </label>
                    {/* Toggle button to show/hide advanced filters */}
                    <button type="button" className="filters-toggle" onClick={() => setShowAdvancedFilters((prev) => !prev)}>
                        {showAdvancedFilters ? t('transactions.hideAdvancedFilters') : t('transactions.advancedFilters')}
                    </button>
                </div>
                
                {/* Advanced filters panel - shown when toggle is clicked */}
                {showAdvancedFilters && (
                    <div className="filters-advanced">
                        <div className="filters-advanced-grid">
                            {/* Column 1: Points Amount Filters */}
                            <div className="filters-advanced-column">
                                <label>
                                    {t('transactions.pointsAmountMin')}
                                    <input
                                        type="number"
                                        value={filters.pointsMin}
                                        onChange={(e) => handleFilterChange('pointsMin', e.target.value)}
                                        placeholder="0"
                                    />
                                </label>
                                <label>
                                    {t('transactions.pointsAmountMax')}
                                    <input
                                        type="number"
                                        value={filters.pointsMax}
                                        onChange={(e) => handleFilterChange('pointsMax', e.target.value)}
                                        placeholder="0"
                                    />
                                </label>
                            </div>
                            
                            {/* Column 2: Spent Amount Filters (for purchases) */}
                            <div className="filters-advanced-column">
                                <label>
                                    {t('transactions.spentAmountMin')}
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={filters.spentMin}
                                        onChange={(e) => handleFilterChange('spentMin', e.target.value)}
                                        placeholder="0.00"
                                    />
                                </label>
                                <label>
                                    {t('transactions.spentAmountMax')}
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={filters.spentMax}
                                        onChange={(e) => handleFilterChange('spentMax', e.target.value)}
                                        placeholder="0.00"
                                    />
                                </label>
                            </div>
                            
                            {/* Column 3: Promotion ID */}
                            <div className="filters-advanced-column">
                                <label>
                                    {t('transactions.promotionId')}
                                    <input
                                        type="number"
                                        placeholder={t('transactions.promotionId')}
                                        value={filters.promotionId}
                                        onChange={(e) => handleFilterChange('promotionId', e.target.value)}
                                    />
                                </label>
                            </div>
                            
                            {/* Column 4 & 5: Manager-only filters */}
                            {isManager && (
                                <>
                                    <div className="filters-advanced-column">
                                        <label>
                                            {t('transactions.searchByUser')}
                                            <input
                                                type="text"
                                                placeholder={t('transactions.userPlaceholder')}
                                                value={filters.name}
                                                onChange={(e) => handleFilterChange('name', e.target.value)}
                                            />
                                        </label>
                                        <label>
                                            {t('transactions.createdBy')}
                                            <input
                                                type="text"
                                                placeholder={t('transactions.createdByPlaceholder')}
                                                value={filters.createdBy}
                                                onChange={(e) => handleFilterChange('createdBy', e.target.value)}
                                            />
                                        </label>
                                    </div>
                                    <div className="filters-advanced-column">
                                        <label>
                                            {t('transactions.suspiciousStatus')}
                                            <select
                                                value={filters.suspicious}
                                                onChange={(e) => handleFilterChange('suspicious', e.target.value)}
                                            >
                                                <option value="all">{t('transactions.suspiciousAll')}</option>
                                                <option value="true">{t('transactions.suspiciousTrue')}</option>
                                                <option value="false">{t('transactions.suspiciousFalse')}</option>
                                            </select>
                                        </label>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {error && <Error error={error} />}

            {loading ? (
                <Loading message={t('transactions.loading')} />
            ) : data.results.length === 0 ? (
                <div className="transactions-empty">
                    <p>{t('transactions.noMatches')}</p>
                </div>
            ) : (
                <section className="transactions-list">
                    <ul>
                        {data.results.map(transaction => (
                            <Transaction 
                                key={transaction.id} 
                                transaction={transaction}
                                onDetailClick={(id) => {
                                    setSelectedTransactionId(id);
                                    setTransactionModalOpen(true);
                                }}
                            />
                        ))}
                    </ul>
                </section>
            )}

            {/* Transaction Detail Modal */}
            <TransactionDetailModal
                transactionId={selectedTransactionId}
                isOpen={transactionModalOpen}
                onClose={() => {
                    setTransactionModalOpen(false);
                    setSelectedTransactionId(null);
                }}
            />

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button 
                        type="button" 
                        disabled={page === 1} 
                        onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    >
                        {t('pagination.previous')}
                    </button>
                    <span className="results-meta">{t('pagination.page')} {page} {t('pagination.of')} {totalPages}</span>
                    <button
                        type="button"
                        disabled={page === totalPages}
                        onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    >
                        {t('pagination.next')}
                    </button>
                </div>
            )}
        </div>
    );
}

export default Transactions;
