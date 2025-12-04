import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage, translatePromotionDescription } from '../contexts/LanguageContext.jsx';
import { authenticatedFetch } from '../utils/api.js';
import { Error, Loading, PromotionDetailModal } from '../components';
import './cashierCreatePurchase.css';

/**
 * Cashier Create Purchase Transaction Page
 * Allows cashiers to create purchase transactions for members
 */

// Utility function to check if a promotion is currently active based on dates
const isPromotionActiveByDate = (promotion) => {
    if (!promotion || !promotion.startTime || !promotion.endTime) return false;
    const now = Date.now();
    const startTime = new Date(promotion.startTime).getTime();
    const endTime = new Date(promotion.endTime).getTime();
    return startTime <= now && now < endTime;
};

// Utility function to find a promotion in either automatic list or user's wallet
const findPromotion = (promotionId, automaticPromotionsList, userPromotions) => {
    return automaticPromotionsList.find(p => p.id === promotionId) ||
           userPromotions?.find(p => p.id === promotionId) ||
           null;
};

// Utility function to get active automatic promotion IDs
const getActiveAutomaticPromotionIds = (automaticPromotionsList) => {
    return automaticPromotionsList
        .filter(isPromotionActiveByDate)
        .map(p => p.id);
};

function CashierCreatePurchase() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    
    const [utorid, setUtorid] = useState('');
    const [spent, setSpent] = useState('');
    const [showRemarks, setShowRemarks] = useState(false);
    const [remark, setRemark] = useState('');
    const [selectedPromotions, setSelectedPromotions] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [createdTransaction, setCreatedTransaction] = useState(null);
    const [userError, setUserError] = useState('');
    const [selectedPromotionDetail, setSelectedPromotionDetail] = useState(null);
    const [automaticPromotionsList, setAutomaticPromotionsList] = useState([]);
    
    const searchTimeoutRef = useRef(null);

    // Fetch all active automatic promotions on component mount
    useEffect(() => {
        const fetchAutomaticPromotions = async () => {
            try {
                const response = await authenticatedFetch('/promotions?type=automatic&status=active&limit=100&page=1');
                if (response.ok) {
                    const data = await response.json();
                    // Filter to only include truly active promotions (check dates)
                    const active = data.results.filter(p => p.isActive && isPromotionActiveByDate(p));
                    setAutomaticPromotionsList(active);
                }
            } catch (err) {
                // Silently handle error - promotions list will remain empty
            }
        };

        fetchAutomaticPromotions();
    }, []);

    // Debounced user search as they type
    useEffect(() => {
        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Reset user and error when UTORid changes
        if (!utorid.trim()) {
            setUser(null);
            setUserError('');
            setSelectedPromotions([]);
            return;
        }

        // Set a timeout to search after user stops typing (500ms)
        searchTimeoutRef.current = setTimeout(async () => {
            await searchUser(utorid.trim());
        }, 500);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [utorid]);

    // Search for user by UTORid
    const searchUser = async (utoridToSearch) => {
        if (!utoridToSearch || !utoridToSearch.trim()) {
            setUser(null);
            setUserError('');
            setSelectedPromotions([]);
            return;
        }

        setSearching(true);
        setUserError('');
        setUser(null);
        setSelectedPromotions([]);

        try {
            const response = await authenticatedFetch(`/users/search/${encodeURIComponent(utoridToSearch.trim())}`);
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 404) {
                    setUserError('User not found. Please check the UTORid.');
                } else {
                    setUserError(data.Message || data.message || 'Failed to find user');
                }
                setUser(null);
                setSelectedPromotions([]);
                return;
            }

            setUser(data);
            setUserError('');
            
            // Auto-select all active automatic promotions from the system-wide list
            const activeAutomaticPromotionIds = getActiveAutomaticPromotionIds(automaticPromotionsList);
            setSelectedPromotions(activeAutomaticPromotionIds);
        } catch (err) {
            setUserError(err.message || t('error.failedToFindUser'));
            setUser(null);
            setSelectedPromotions([]);
        } finally {
            setSearching(false);
        }
    };

    // Handle promotion toggle (only for one-time promotions)
    const togglePromotion = useCallback((promotionId) => {
        const promotion = findPromotion(promotionId, automaticPromotionsList, user?.promotions);
        
        // Don't allow toggling automatic promotions - they're always included
        if (promotion && (promotion.type || '').toLowerCase() === 'automatic') {
            return;
        }
        
        setSelectedPromotions(prev => 
            prev.includes(promotionId)
                ? prev.filter(id => id !== promotionId)
                : [...prev, promotionId]
        );
    }, [automaticPromotionsList, user?.promotions]);

    // Check if promotion meets minimum spending
    const meetsMinSpending = useCallback((promotion) => {
        if (!promotion?.minSpending) return true;
        const spentAmount = parseFloat(spent);
        if (isNaN(spentAmount)) return false;
        return spentAmount >= promotion.minSpending;
    }, [spent]);

    // Calculate estimated points
    const calculateEstimatedPoints = useCallback(() => {
        const spentAmount = parseFloat(spent);
        if (!spent || isNaN(spentAmount) || spentAmount <= 0) {
            return 0;
        }

        const basePoints = Math.ceil(spentAmount * 4);
        
        const promotionPoints = selectedPromotions.reduce((total, promoId) => {
            const promotion = findPromotion(promoId, automaticPromotionsList, user?.promotions);
            
            if (promotion && isPromotionActiveByDate(promotion) && meetsMinSpending(promotion)) {
                const points = (promotion.points || 0) + 
                    (promotion.rate > 0 ? Math.ceil(spentAmount * promotion.rate * 100) : 0);
                return total + points;
            }
            return total;
        }, 0);

        return basePoints + promotionPoints;
    }, [spent, selectedPromotions, automaticPromotionsList, user?.promotions, meetsMinSpending]);

    // Get automatic promotions from system-wide list (not from user's wallet)
    const automaticPromotions = useMemo(() => {
        return automaticPromotionsList.filter(isPromotionActiveByDate);
    }, [automaticPromotionsList]);

    // Get one-time promotions from user's wallet
    const oneTimePromotions = useMemo(() => {
        if (!user?.promotions) return [];
        return user.promotions.filter(p => 
            (p.type || '').toLowerCase() === 'onetime' && isPromotionActiveByDate(p)
        );
    }, [user?.promotions]);

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!user) {
            setError('Please enter a valid UTORid and wait for member verification');
            return;
        }

        const spentAmount = parseFloat(spent);
        if (isNaN(spentAmount) || spentAmount <= 0) {
            setError('Please enter a valid amount spent');
            return;
        }

        setLoading(true);

        try {
            // Filter promotions - check both automatic promotions list and user's wallet
            const validPromotions = selectedPromotions.filter(promoId => {
                const promotion = findPromotion(promoId, automaticPromotionsList, user?.promotions);
                if (!promotion) return false;
                
                const type = (promotion.type || '').toLowerCase();
                
                // For automatic promotions, only include if they meet spending requirements
                if (type === 'automatic') {
                    return meetsMinSpending(promotion);
                }
                
                // For one-time promotions, include if selected (backend will validate)
                return true;
            });

            const requestBody = {
                utorid: user.utorid.trim(),
                type: 'purchase',
                spent: spentAmount, // Keep as float, don't convert with Number() which might cause precision issues
                promotionIds: validPromotions.length > 0 ? validPromotions : [],
            };

            if (showRemarks && remark && remark.trim()) {
                requestBody.remark = remark.trim();
            }

            const response = await authenticatedFetch('/transactions', {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });

            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                try {
                    data = await response.json();
                } catch (e) {
                    throw new Error(`${t('error.serverError')}: ${response.status} ${response.statusText}`);
                }
            } else {
                throw new Error(`${t('error.serverError')}: ${response.status} ${response.statusText}`);
            }

            if (!response.ok) {
                let errorMsg = data?.Message || data?.message || data?.error || `${t('error.failedToCreateTransaction')} (${response.status})`;
                
                if (response.status === 400) {
                    if (requestBody.promotionIds && requestBody.promotionIds.length > 0) {
                        errorMsg += '. ' + t('error.promotionExpiredOrNotMet');
                    } else {
                        errorMsg += '. ' + t('error.checkRequiredFields');
                    }
                }
                
                throw new Error(errorMsg);
            }

            setCreatedTransaction(data);
            setSuccess(true);
            
            // Refresh user data to get updated promotions (one-time promotions will be removed)
            if (user) {
                try {
                    const userResponse = await authenticatedFetch(`/users/search/${encodeURIComponent(user.utorid.trim())}`);
                    if (userResponse.ok) {
                        const updatedUser = await userResponse.json();
                        setUser(updatedUser);
                        // Update selected promotions to only include automatic promotions
                        const activeAutomaticPromotionIds = getActiveAutomaticPromotionIds(automaticPromotionsList);
                        setSelectedPromotions(activeAutomaticPromotionIds);
                    }
                } catch (err) { }
            }
            
            // Reset form after 2 seconds
            setTimeout(() => {
                setUtorid('');
                setSpent('');
                setRemark('');
                setShowRemarks(false);
                setSelectedPromotions([]);
                setUser(null);
                setSuccess(false);
                setCreatedTransaction(null);
            }, 2000);
        } catch (err) {
            setError(err.message || t('error.failedToCreateTransaction'));
        } finally {
            setLoading(false);
        }
    };

    const allPromotions = useMemo(() => [...automaticPromotions, ...oneTimePromotions], [automaticPromotions, oneTimePromotions]);

    return (
        <div className="cashier-create-purchase container">
            <div className="page-header">
                <h1>{t('cashierPurchase.title')}</h1>
                <p>{t('cashierPurchase.subtitle')}</p>
            </div>

            {error && <Error error={error} />}
            
            {success && createdTransaction && (
                <div className="success-message">
                    <p>✓ {t('cashierPurchase.transactionCreated')}</p>
                    <p>{t('cashierPurchase.memberEarned')} {createdTransaction.amount} {t('transactionCard.points')}</p>
                </div>
            )}

            <form className="cashier-form" onSubmit={handleSubmit}>
                {/* User Search Section */}
                <section className="form-section">
                    <h2>{t('cashierPurchase.memberInfo')}</h2>
                    <div className="form-group">
                        <label htmlFor="utorid">
                            {t('cashierPurchase.memberUtorid')}
                            <span className="required">*</span>
                        </label>
                        <div className="search-group">
                            <input
                                type="text"
                                id="utorid"
                                value={utorid}
                                onChange={(e) => setUtorid(e.target.value)}
                                placeholder={t('cashierPurchase.memberUtoridPlaceholder')}
                                disabled={loading}
                                className={userError ? 'input-error' : user ? 'input-success' : ''}
                            />
                            {searching && (
                                <span className="searching-indicator">{t('cashierPurchase.searching')}</span>
                            )}
                        </div>
                        {userError && (
                            <small className="form-error">{userError}</small>
                        )}
                        {user && !userError && (
                            <small className="form-success">✓ {t('cashierPurchase.memberFound')}</small>
                        )}
                    </div>
                </section>

                {/* Purchase Details Section - Only show if user is found */}
                {user && (
                    <>
                        <section className="form-section">
                            <h2>{t('cashierPurchase.transactionDetails')}</h2>
                            <div className="form-group">
                                <label htmlFor="spent">
                                    {t('cashierPurchase.amountSpent')}
                                    <span className="required">*</span>
                                </label>
                                <input
                                    type="number"
                                    id="spent"
                                    value={spent}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                            setSpent(value);
                                        }
                                    }}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <div className="toggle-group">
                                    <label htmlFor="showRemarks" className="toggle-label">
                                        <input
                                            type="checkbox"
                                            id="showRemarks"
                                            checked={showRemarks}
                                            onChange={(e) => setShowRemarks(e.target.checked)}
                                            disabled={loading}
                                        />
                                        <span className="toggle-text">{t('cashierPurchase.addRemarks')}</span>
                                    </label>
                                </div>
                                {showRemarks && (
                                    <textarea
                                        id="remark"
                                        value={remark}
                                        onChange={(e) => setRemark(e.target.value)}
                                        placeholder={t('cashierPurchase.remarksPlaceholder')}
                                        rows="3"
                                        disabled={loading}
                                        style={{ marginTop: '0.5rem' }}
                                    />
                                )}
                            </div>
                        </section>

                        {/* Promotions Section */}
                        <section className="form-section">
                            <h2>{t('cashierPurchase.promotions')}</h2>
                            
                            {allPromotions.length === 0 ? (
                                <div className="no-promotions">
                                    <p>{t('cashierPurchase.noPromotionsAvailable')}</p>
                                </div>
                            ) : (
                                <div className="promotions-list">
                                    {/* Automatic Promotions */}
                                    {automaticPromotions.length > 0 && (
                                        <div className="promotion-type-section">
                                            <h4 className="promotion-type-header">{t('cashierPurchase.automaticPromotions')}</h4>
                                            {automaticPromotions.map(promotion => {
                                                const canApply = meetsMinSpending(promotion);
                                                const isSelected = selectedPromotions.includes(promotion.id);
                                                
                                                return (
                                                    <div
                                                        key={promotion.id}
                                                        className={`promotion-card automatic ${!canApply ? 'disabled' : ''}`}
                                                    >
                                                        <div className="promotion-header">
                                                            <div>
                                                                <h4>{promotion.name}</h4>
                                                                <span className="promotion-badge automatic-badge">{t('cashierPurchase.automatic')}</span>
                                                            </div>
                                                            {canApply && isSelected && (
                                                                <span className="auto-applied-badge">{t('cashierPurchase.autoApplied')}</span>
                                                            )}
                                                        </div>
                                                        <p className="promotion-description">{translatePromotionDescription(promotion.description, t)}</p>
                                                        <div className="promotion-details">
                                                            <span>+{promotion.points || 0} {t('cashierPurchase.basePoints')}</span>
                                                            {promotion.rate > 0 && (
                                                                <span>+{Math.round(promotion.rate * 100)}% {t('promotionCard.bonus')}</span>
                                                            )}
                                                            {promotion.minSpending && (
                                                                <span className={`min-spending ${canApply ? '' : 'warning'}`}>
                                                                    {t('promotions.minimumSpend')} ${promotion.minSpending}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {!canApply && (
                                                            <p className="promotion-warning">
                                                                {t('cashierPurchase.minimumSpendingRequired')} ${promotion.minSpending} {t('cashierPurchase.required')} ({t('cashierPurchase.current')} ${spent || '0'})
                                                            </p>
                                                        )}
                                                        {canApply && (
                                                            <p className="promotion-info">
                                                                {t('cashierPurchase.willBeAutoApplied')}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* One-Time Promotions */}
                                    {oneTimePromotions.length > 0 && (
                                        <div className="promotion-type-section">
                                            <h4 className="promotion-type-header">{t('cashierPurchase.oneTimePromotions')}</h4>
                                            {oneTimePromotions.map(promotion => {
                                                const isSelected = selectedPromotions.includes(promotion.id);
                                                const canApply = meetsMinSpending(promotion);
                                                
                                                return (
                                                    <div
                                                        key={promotion.id}
                                                        className={`promotion-card onetime ${isSelected ? 'selected' : ''} ${!canApply ? 'disabled' : ''}`}
                                                        onClick={() => canApply && togglePromotion(promotion.id)}
                                                    >
                                                        <div className="promotion-summary-line">
                                                            <span className="promotion-name">{promotion.name}</span>
                                                            <span className="promotion-points">+{promotion.points || 0} {t('cashierPurchase.points')}</span>
                                                            {promotion.minSpending && (
                                                                <span className={`promotion-min-spending ${canApply ? '' : 'warning'}`}>
                                                                    {t('promotions.minimumSpend')} ${promotion.minSpending}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="promotion-detail-link"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedPromotionDetail(promotion.id);
                                                            }}
                                                        >
                                                            {t('cashierPurchase.clickToSeeDetails')}
                                                        </button>
                                                        {!canApply && (
                                                            <p className="promotion-warning">
                                                                {t('cashierPurchase.minimumSpendingRequired')} ${promotion.minSpending} {t('cashierPurchase.required')} ({t('cashierPurchase.current')} ${spent || '0'})
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* Estimated Points Preview */}
                        {spent && !isNaN(parseFloat(spent)) && parseFloat(spent) > 0 && (
                            <section className="form-section">
                                <div className="points-preview">
                                    <h3>{t('cashierPurchase.estimatedPoints')}</h3>
                                    <p className="points-value">{calculateEstimatedPoints().toLocaleString()} {t('transactionCard.points')}</p>
                                    <p className="points-breakdown">
                                        {t('cashierPurchase.base')} {Math.ceil(parseFloat(spent) * 4)} + 
                                        {t('cashierPurchase.promotionsLabel')} {calculateEstimatedPoints() - Math.ceil(parseFloat(spent) * 4)}
                                    </p>
                                </div>
                            </section>
                        )}

                        {/* Submit Button */}
                        <div className="form-actions">
                            <button
                                type="submit"
                                className="primary-btn"
                                disabled={loading || !spent || isNaN(parseFloat(spent)) || parseFloat(spent) <= 0}
                            >
                                {loading ? t('cashierPurchase.creating') : t('cashierPurchase.createTransaction')}
                            </button>
                            <button
                                type="button"
                                className="cancel-btn"
                                onClick={() => navigate('/dashboard')}
                                disabled={loading}
                            >
                                {t('cashierPurchase.cancel')}
                            </button>
                        </div>
                    </>
                )}
            </form>

            {/* Promotion Detail Modal */}
            {selectedPromotionDetail && (
                <PromotionDetailModal
                    promotionId={selectedPromotionDetail}
                    isOpen={!!selectedPromotionDetail}
                    onClose={() => setSelectedPromotionDetail(null)}
                    onPromotionUpdated={() => {}}
                />
            )}
        </div>
    );
}

export default CashierCreatePurchase;
