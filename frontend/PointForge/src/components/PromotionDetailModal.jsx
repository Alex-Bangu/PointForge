import { useContext, useEffect, useState } from 'react';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import Loading from './Loading.jsx';
import Error from './Error.jsx';
import PromotionEditorModal from './PromotionEditorModal.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { authenticatedFetch } from '../utils/api.js';
import { formatDate } from '../utils/dateUtils.js';
import { buildPromotionPayload } from '../utils/promotionUtils.js';
import './PromotionDetailModal.css';

/**
 * Promotion Detail Modal
 * @param {string} promotionId - ID of the promotion to display
 * @param {boolean} isOpen - Whether the modal is currently open
 * @param {function} onClose - Callback to close the modal
 * @param {function} onPromotionUpdated - Callback when promotion is updated (refreshes parent list)
 */
function PromotionDetailModal({ promotionId, isOpen, onClose, onPromotionUpdated }) {
    // Get current user to determine permissions and refresh function
    const { user, refreshUserData } = useContext(UserContext);
    const { t } = useLanguage();
    const isManager = user?.role === 'manager' || user?.role === 'superuser';
    const isRegular = user?.role === 'regular';

    // State for the promotion data being displayed
    const [promotion, setPromotion] = useState(null);
    const [loading, setLoading] = useState(true);      // Loading state while fetching
    const [error, setError] = useState('');            // Error message if fetch fails
    
    // State for confirmation modal before adding to wallet
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    
    // State for confirmation modal before removing from wallet
    const [removeConfirmModalOpen, setRemoveConfirmModalOpen] = useState(false);
    
    // State for the edit promotion modal (nested modal for managers)
    const [modalOpen, setModalOpen] = useState(false);
    const [modalBusy, setModalBusy] = useState(false);
    const [modalError, setModalError] = useState('');
    
    // State for adding promotions to wallet (regular users)
    const [applying, setApplying] = useState(false);
    
    // State for removing promotions from wallet (regular users)
    const [removing, setRemoving] = useState(false);
    
    // Refresh key to force re-fetch when promotion is updated
    const [refreshKey, setRefreshKey] = useState(0);


    // Fetch promotion data when modal opens
    // Only fetches if modal is open and we have a promotionId
    useEffect(() => {
        if(!isOpen || !promotionId) {
            return;  // Don't fetch if modal is closed or no ID provided
        }
        
        const controller = new AbortController();  // Allows canceling request
        
        const fetchPromotion = async () => {
            setLoading(true);
            setError('');
            try {
                // Fetch promotion details from API
                const response = await authenticatedFetch(`/promotions/${promotionId}`, {
                    signal: controller.signal
                });
                const payload = await response.json();
                if(!response.ok) {
                    throw new Error(payload.message || payload.Message || t('error.unableToLoad') + ' promotion');
                }
                setPromotion(payload);  // Save promotion data
            } catch (err) {
                if(err.name === 'AbortError') {
                    return;  // Request was cancelled, ignore
                }
                setError(err.message || t('error.unableToLoad') + ' promotion');
            } finally {
                setLoading(false);
            }
        };
        fetchPromotion();
        
        // Cleanup: Cancel request if modal closes or component unmounts
        return () => controller.abort();
    }, [promotionId, refreshKey, isOpen]);

    // Refresh promotion data (called after adding to wallet or editing)
    const refresh = () => {
        setRefreshKey((key) => key + 1);  // Increment key to trigger re-fetch
        if(onPromotionUpdated) {
            onPromotionUpdated();  // Notify parent to refresh its list too
        }
    };

    // Show confirmation modal before adding to wallet
    // Close the detail modal first to prevent stacking
    const handleApplyClick = () => {
        if(!promotion) {
            return;
        }
        setConfirmModalOpen(true);
    };

    // Actually add the promotion to wallet after user confirms
    const handleApply = async () => {
        if(!promotion) {
            return;
        }
        setConfirmModalOpen(false);  // Close confirmation modal
        setApplying(true);
        try {
            const response = await authenticatedFetch(`/promotions/${promotion.id}/use`, {
                method: 'POST'
            });
            
            // authenticatedFetch handles 401 automatically
            if(response.status === 401) {
                throw new Error(t('error.sessionExpired'));
            }
            
            const contentType = response.headers.get('content-type');
            let payload;
            if(contentType && contentType.includes('application/json')) {
                payload = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
            
            if(!response.ok) {
                throw new Error(payload.message || t('promotionDetail.addToWallet') + ' failed');
            }
            // Refresh user data (which includes promotions) before closing modal
            // This ensures the wallet list updates immediately
            if(refreshUserData) {
                await refreshUserData();
            }
            // Notify parent to refresh its list as well
            if(onPromotionUpdated) {
                onPromotionUpdated();
            }
            setApplying(false);
            // Close the promotion detail modal after data is refreshed
            onClose();
        } catch (err) {
            setError(err.message || t('promotionDetail.addToWallet') + ' failed');
            setApplying(false);  // Only set applying to false on error (on success, modal closes)
        }
    };

    // Show confirmation modal before removing from wallet
    // Close the detail modal first to prevent stacking
    const handleRemoveClick = () => {
        if(!promotion) {
            return;
        }
        setRemoveConfirmModalOpen(true);
    };

    // Actually remove the promotion from wallet after user confirms
    const handleRemove = async () => {
        if(!promotion) {
            return;
        }
        setRemoveConfirmModalOpen(false);  // Close confirmation modal
        setRemoving(true);
        try {
            const response = await authenticatedFetch(`/promotions/${promotion.id}/use`, {
                method: 'DELETE'
            });
            
            // authenticatedFetch handles 401 automatically
            if(response.status === 401) {
                throw new Error(t('error.sessionExpired'));
            }
            
            const contentType = response.headers.get('content-type');
            let payload;
            if(contentType && contentType.includes('application/json')) {
                payload = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
            
            if(!response.ok) {
                throw new Error(payload.message || t('promotionDetail.removeFromWallet') + ' failed');
            }
            // Refresh user data (which includes promotions) before closing modal
            // This ensures the wallet list updates immediately
            if(refreshUserData) {
                await refreshUserData();
            }
            // Notify parent to refresh its list as well
            if(onPromotionUpdated) {
                onPromotionUpdated();
            }
            setRemoving(false);
            // Close the promotion detail modal after data is refreshed
            onClose();
        } catch (err) {
            setError(err.message || t('promotionDetail.removeFromWallet') + ' failed');
            setRemoving(false);  // Only set removing to false on error (on success, modal closes)
        }
    };

    // Delete promotion (managers only)
    const handleDelete = async () => {
        if(!promotion) {
            return;
        }
        // Confirm deletion - destructive action
        const confirmed = window.confirm(t('promotionDetail.deleteConfirm'));
        if(!confirmed) {
            return;
        }
        try {
            const response = await authenticatedFetch(`/promotions/${promotion.id}`, {
                method: 'DELETE'
            });
            if(response.status !== 204) {
                const payload = await response.json().catch(() => ({}));
                if(!response.ok) {
                    throw new Error(payload.message || payload.Message || t('error.unableToDelete') + ' promotion');
                }
            }
            onClose();  // Close modal after successful deletion
            if(onPromotionUpdated) {
                onPromotionUpdated();  // Refresh parent list
            }
        } catch (err) {
            setError(err.message || t('error.unableToDelete') + ' promotion');
        }
    };

    // Save edited promotion (managers only)
    const handleSave = async (values) => {
        if(!promotion) {
            return;
        }
        setModalBusy(true);
        setModalError('');
        try {
            const payload = buildPromotionPayload(values);
            const response = await authenticatedFetch(`/promotions/${promotion.id}`, {
                method: 'PATCH',
                body: JSON.stringify(payload)
            });
            const body = await response.json().catch(() => ({}));
            if(!response.ok) {
                console.log(body)
                console.log(body.message);
                const errorMessage = body.message;
                setModalError(errorMessage);
                throw new Error(errorMessage);
            }
            setModalOpen(false);  // Close edit modal
            setToast(t('promotions.promotionUpdated'));
            refresh();  // Refresh to show updated data
        } catch (err) {
            console.log(err.message);
        } finally {
            setModalBusy(false);
        }
    };

    // Don't render detail modal if closed, but keep component mounted if confirmation modals are open
    const showDetailModal = isOpen && !confirmModalOpen && !removeConfirmModalOpen;
    
    // Keep component mounted if confirmation modals are open, even if detail modal is closed
    const shouldRender = isOpen || confirmModalOpen || removeConfirmModalOpen;

    // Handle clicking outside modal to close it
    // Only closes if clicking the overlay (dark background), not the modal itself
    const handleOverlayClick = (e) => {
        if(e.target === e.currentTarget) {
            onClose();
        }
    };

    // Don't render anything if modal is closed and no confirmation modals are open
    if(!shouldRender) {
        return null;
    }

    // Show loading spinner while fetching promotion data (only if detail modal should be shown)
    if(loading && showDetailModal) {
        return (
            <div className="promotion-detail-modal-overlay" onClick={handleOverlayClick}>
                <div className="promotion-detail-modal" onClick={(e) => e.stopPropagation()}>
                    <Loading message={t('promotionDetail.loading')} />
                </div>
            </div>
        );
    }

    // Show error if fetch failed and we don't have promotion data (only if detail modal should be shown)
    if(error && !promotion && showDetailModal) {
        return (
            <div className="promotion-detail-modal-overlay" onClick={handleOverlayClick}>
                <div className="promotion-detail-modal" onClick={(e) => e.stopPropagation()}>
                    <Error error={error} />
                </div>
            </div>
        );
    }

    if(!promotion) {
        return null;
    }

    // Calculate promotion status and format display values
    const statusKey = promotion.alreadyUsed ? 'in wallet' : promotion.hasEnded ? 'ended' : promotion.isUpcoming ? 'upcoming' : 'active';
    const statusLabel = promotion.alreadyUsed ? t('promotionDetail.statusInWallet') : promotion.hasEnded ? t('promotionDetail.statusEnded') : promotion.isUpcoming ? t('promotionDetail.statusUpcoming') : t('promotionDetail.statusActive');
    const typeLabel = promotion.isOneTime ? t('promotionDetail.typeOneTime') : t('promotionDetail.typeAutomatic');
    
    // Build reward display - only show what exists
    const rewardParts = [];
    if (promotion.rate) {
        rewardParts.push(`${Math.round(promotion.rate * 100)}% bonus`);
    }

    if (promotion.points) {
        rewardParts.push(`${promotion.points} pts`);
    }

    const rewardDisplay = rewardParts.length > 0 ? rewardParts.join(' · ') : t('common.none');
    const minSpending = promotion.minSpending ? `$${promotion.minSpending}` : t('common.n/a');
    
    // Determine if user can add this promotion to wallet
    const canApply = isRegular && promotion.isOneTime;
    const applyDisabled = !promotion.usable || promotion.isUpcoming || promotion.hasEnded || promotion.alreadyUsed;

    return (
        <>
            {/* Detail modal - only show if isOpen and no confirmation modals are open */}
            {showDetailModal && (
                <div className="promotion-detail-modal-overlay" onClick={handleOverlayClick}>
                    <div className="promotion-detail-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header with name, status badges, and close button */}
                <div className="promotion-detail-header">
                    <div className="promotion-detail-header-wrapper">
                        {/* Promotion name comes first for better visual hierarchy */}
                        <h2>{promotion.name}</h2>
                        {/* Status and type badges */}
                        <div className="card-badges">
                            <span className={`promo-badge status-${statusKey.replace(/\s+/g, '-')}`}>{statusLabel}</span>
                            <span className="promo-badge type">{typeLabel}</span>
                        </div>
                    </div>
                    {/* X button to close modal - positioned at top right */}
                    <button className="promotion-detail-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                
                {/* Promotion description */}
                <p>{promotion.description}</p>
                
                {/* Reward and minimum spending information in a grid */}
                <div className="promotion-meta-grid">
                    <div className="promotion-meta-item">
                        <span>{t('promotionDetail.reward')}</span>
                        <strong>{rewardDisplay}</strong>
                    </div>
                    <div className="promotion-meta-item">
                        <span>{t('promotionDetail.minimumSpending')}</span>
                        <strong>{minSpending}</strong>
                    </div>
                </div>
                
                {/* Manager-only action buttons */}
                <div className="promotion-cta">
                    {isManager && (
                        <>
                            <button className="secondary-btn" onClick={() => setModalOpen(true)}>
                                {t('promotionDetail.editPromotion')}
                            </button>
                            <button className="secondary-btn" onClick={handleDelete}>
                                {t('promotionDetail.deletePromotion')}
                            </button>
                        </>
                    )}
                </div>
                
                {/* Footer with validity and eligibility information */}
                <div className="promotion-detail-footer">
                    {/* Horizontal row for valid through date and remove button (for promotions in wallet) */}
                    {(promotion.endTime || (canApply && promotion.alreadyUsed)) && (
                        <div className="promotion-detail-footer-row">
                            {/* Show "Valid through" date if available */}
                            {promotion.endTime && (
                                <span className="valid-through">{t('promotionDetail.validThrough')} {formatDate(promotion.endTime)}</span>
                            )}
                            {/* Remove from wallet button - only shown for promotions already in wallet */}
                            {canApply && promotion.alreadyUsed && (
                                <button className="secondary-btn" disabled={removing} onClick={handleRemoveClick}>
                                    {removing ? t('promotionDetail.removing') : t('promotionDetail.removeFromWallet')}
                                </button>
                            )}
                        </div>
                    )}
                    
                    {/* Regular user view: eligibility message and redeem button */}
                    {!isManager && (() => {
                        // Get the message text (null if already in wallet)
                        const messageText = promotion.isOneTime ? (
                            // Messages for one-time promotions (can be added to wallet)
                            promotion.hasEnded 
                                ? t('promotionDetail.hasEnded')
                                : promotion.isUpcoming 
                                    ? t('promotionDetail.startsSoon')
                                    : promotion.alreadyUsed
                                        ? null // Don't show message if already in wallet
                                        : promotion.usable 
                                            ? t('promotionDetail.notAddedEligible')
                                            : t('promotionDetail.notAddedNotEligible')
                        ) : (
                            // Messages for automatic promotions (applied automatically)
                            promotion.hasEnded 
                                ? t('promotionDetail.hasEnded')
                                : promotion.isUpcoming 
                                    ? t('promotionDetail.startsSoon')
                                    : promotion.usable 
                                        ? t('promotionDetail.autoApplied')
                                        : t('promotionDetail.autoAppliedInactive')
                        );
                        
                        // Determine if we should show the add button
                        const shouldShowAddButton = canApply && promotion.usable && !applyDisabled && !promotion.alreadyUsed && !promotion.hasEnded && !promotion.isUpcoming;
                        
                        // Only render if there's content to show
                        if (!messageText && !shouldShowAddButton) {
                            return null;
                        }
                        
                        return (
                            <div className="promotion-eligibility-message">
                                {/* Single merged message explaining eligibility and usage status */}
                                {messageText && (
                                    <span>{messageText}</span>
                                )}
                                {/* Add to wallet button - only shown for eligible, usable, one-time promotions */}
                                {shouldShowAddButton && (
                                    <button className="primary-btn redeem-btn" disabled={applying} onClick={handleApplyClick}>
                                        {applying ? t('promotionDetail.adding') : t('promotionDetail.addToWallet')}
                                    </button>
                                )}
                            </div>
                        );
                    })()}
                    
                    {/* Manager view: user statistics and status */}
                    {isManager && (
                        <>
                            <span>{promotion.userCount || 0} {t('promotionDetail.userCount')}</span>
                            <span>{promotion.hasEnded ? t('promotionDetail.hasEnded') : promotion.isUpcoming ? t('promotionDetail.startsSoon') : t('promotionDetail.isActive')}</span>
                        </>
                    )}
                </div>

                {/* Nested modal for editing promotion (managers only) */}
                <PromotionEditorModal
                    isOpen={modalOpen}
                    mode="edit"
                    initialValues={promotion}
                    busy={modalBusy}
                    error={modalError}
                    onClose={() => {
                        setModalOpen(false);
                        setModalError('');
                    }}
                    onSubmit={handleSave}
                />
                    </div>
                </div>
            )}

            {/* Confirmation modals - render outside detail modal to prevent stacking */}
            {/* Confirmation modal - asks user to confirm before adding promotion to wallet */}
            <ConfirmModal
                isOpen={confirmModalOpen}
                title={t('promotionDetail.confirmAddTitle')}
                message={t('promotionDetail.confirmAddMessage')}
                confirmText={t('promotionDetail.confirmAddButton')}
                cancelText={t('common.cancel')}
                onConfirm={handleApply}
                onCancel={() => {
                    setConfirmModalOpen(false);
                }}
            />

            {/* Confirmation modal - asks user to confirm before removing promotion from wallet */}
            <ConfirmModal
                isOpen={removeConfirmModalOpen}
                title={t('promotionDetail.confirmRemoveTitle')}
                message={t('promotionDetail.confirmRemoveMessage')}
                confirmText={t('promotionDetail.confirmRemoveButton')}
                cancelText={t('common.cancel')}
                onConfirm={handleRemove}
                onCancel={() => {
                    setRemoveConfirmModalOpen(false);
                }}
            />
        </>
    );
}

export default PromotionDetailModal;

