import { useContext, useEffect, useState } from 'react';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import Loading from './Loading.jsx';
import Error from './Error.jsx';
import { authenticatedFetch } from '../utils/api.js';
import { formatDate } from '../utils/dateUtils.js';
import './TransactionDetailModal.css';

/**
 * Transaction Detail Modal
 * @param {number} transactionId - ID of the transaction to display
 * @param {boolean} isOpen - Whether the modal is currently open
 * @param {function} onClose - Callback to close the modal
 */
function TransactionDetailModal({ transactionId, isOpen, onClose }) {
    const { user } = useContext(UserContext);
    const { t } = useLanguage();
    const isManager = user?.role === 'manager' || user?.role === 'superuser';

    const [transaction, setTransaction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen || !transactionId) {
            return;
        }

        const controller = new AbortController();

        const fetchTransaction = async () => {
            setLoading(true);
            setError('');
            try {
                // For regular users, use /users/me/transactions endpoint and find the specific one
                // For managers, use /transactions/:transactionId
                const endpoint = isManager 
                    ? `/transactions/${transactionId}`
                    : `/users/me/transactions?limit=1000`; // Get all to find the one we need

                const response = await authenticatedFetch(endpoint, {
                    signal: controller.signal
                });

                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.dispatchEvent(new CustomEvent('tokenChange', { detail: { action: 'logout' } }));
                    throw new Error(t('error.sessionExpired'));
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
                    throw new Error(payload.message || payload.Message || t('error.unableToLoad') + ' transaction');
                }

                // If regular user, find the transaction from the results array
                if (!isManager && payload.results) {
                    const found = payload.results.find(t => t.id === transactionId);
                    if (!found) {
                        throw new Error(t('error.unableToLoad') + ' transaction');
                    }
                    setTransaction(found);
                } else {
                    setTransaction(payload);
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    return;
                }
                setError(err.message || t('error.unableToLoad') + ' transaction');
            } finally {
                setLoading(false);
            }
        };

        fetchTransaction();
        return () => controller.abort();
    }, [transactionId, isOpen, isManager]);

    if (!isOpen) {
        return null;
    }

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'purchase': return '#4CAF50';
            case 'redemption': return '#F44336';
            case 'transfer': return '#2196F3';
            case 'event': return '#FF9800';
            case 'adjustment': return '#9C27B0';
            default: return '#015c42';
        }
    };

    const getTypeLabel = (type) => {
        switch (type) {
            case 'purchase': return t('transactionDetail.typePurchase');
            case 'redemption': return t('transactionDetail.typeRedemption');
            case 'transfer': return t('transactionDetail.typeTransfer');
            case 'event': return t('transactionDetail.typeEvent');
            case 'adjustment': return t('transactionDetail.typeAdjustment');
            default: return type.charAt(0).toUpperCase() + type.slice(1);
        }
    };

    return (
        <div className="transaction-detail-overlay" onClick={handleOverlayClick}>
            <div className="transaction-detail-modal">
                <button className="transaction-detail-close" onClick={onClose}>×</button>
                
                {loading && <Loading message={t('transactionDetail.loading')} />}
                {error && <Error error={error} />}
                
                {transaction && !loading && !error && (
                    <div className="transaction-detail-content">
                        <div className="transaction-detail-header">
                            <div className="transaction-detail-header-title">
                                <h2 style={{ color: getTypeColor(transaction.type) }}>
                                    {getTypeLabel(transaction.type)} {t('transactionDetail.type')}
                                </h2>
                                {transaction.suspicious && (
                                    <span className="transaction-badge transaction-badge--suspicious">{t('transactionDetail.suspicious')}</span>
                                )}
                            </div>
                        </div>

                        <div className="transaction-detail-body">
                            <div className="transaction-detail-grid">
                                <div className="transaction-detail-item">
                                    <span>{t('transactionDetail.transactionId')}</span>
                                    <strong>#{transaction.id}</strong>
                                </div>

                                <div className="transaction-detail-item">
                                    <span>{t('transactionDetail.type')}</span>
                                    <strong>{getTypeLabel(transaction.type)}</strong>
                                </div>

                                {transaction.type === 'purchase' && (
                                    <>
                                        <div className="transaction-detail-item">
                                            <span>{t('transactionDetail.amountSpent')}</span>
                                            <strong>${(Number(transaction.spent) || 0).toFixed(2)}</strong>
                                        </div>
                                        <div className="transaction-detail-item">
                                            <span>{t('transactionDetail.pointsEarned')}</span>
                                            <strong>+{transaction.amount || 0} pts</strong>
                                        </div>
                                    </>
                                )}

                                {transaction.type === 'redemption' && (
                                    <div className="transaction-detail-item">
                                        <span>{t('transactionDetail.pointsRedeemed')}</span>
                                        <strong>{Math.abs(transaction.redeemed || transaction.amount || 0)} pts</strong>
                                    </div>
                                )}

                                {transaction.type === 'transfer' && (
                                    <>
                                        <div className="transaction-detail-item">
                                            <span>{t('transactionDetail.sender')}</span>
                                            <strong>{transaction.sender || transaction.utorid || t('common.n/a')}</strong>
                                        </div>
                                        <div className="transaction-detail-item">
                                            <span>{t('transactionDetail.recipient')}</span>
                                            <strong>{transaction.recipient || transaction.utorid || t('common.n/a')}</strong>
                                        </div>
                                        <div className="transaction-detail-item">
                                            <span>{t('transactionDetail.amount')}</span>
                                            <strong>{transaction.sent || Math.abs(transaction.amount || 0)} pts</strong>
                                        </div>
                                    </>
                                )}

                                {transaction.type === 'event' && (
                                    <>
                                        <div className="transaction-detail-item">
                                            <span>{t('transactionDetail.recipient')}</span>
                                            <strong>{transaction.recipient || transaction.utorid || t('common.n/a')}</strong>
                                        </div>
                                        <div className="transaction-detail-item">
                                            <span>{t('transactionDetail.pointsAwarded')}</span>
                                            <strong>+{transaction.awarded || transaction.amount || 0} pts</strong>
                                        </div>
                                    </>
                                )}

                                {transaction.type === 'adjustment' && (
                                    <>
                                        <div className="transaction-detail-item">
                                            <span>{t('transactionDetail.user')}</span>
                                            <strong>{transaction.utorid || t('common.n/a')}</strong>
                                        </div>
                                        <div className="transaction-detail-item">
                                            <span>{t('transactionDetail.adjustmentAmount')}</span>
                                            <strong>{(transaction.amount >= 0 ? '+' : '')}{transaction.amount || 0} pts</strong>
                                        </div>
                                        {transaction.relatedId && (
                                            <div className="transaction-detail-item">
                                                <span>{t('transactionDetail.relatedTransaction')}</span>
                                                <strong>#{transaction.relatedId}</strong>
                                            </div>
                                        )}
                                    </>
                                )}

                                {transaction.createdBy && (
                                    <div className="transaction-detail-item">
                                        <span>{t('transactionDetail.createdBy')}</span>
                                        <strong>{transaction.createdBy}</strong>
                                    </div>
                                )}

                                {transaction.processedBy && (
                                    <div className="transaction-detail-item">
                                        <span>{t('transactionDetail.processedBy')}</span>
                                        <strong>{transaction.processedBy}</strong>
                                    </div>
                                )}

                                {transaction.promotionIds && transaction.promotionIds.length > 0 && (
                                    <div className="transaction-detail-item">
                                        <span>{t('transactionDetail.appliedPromotions')}</span>
                                        <strong>{transaction.promotionIds.map(id => `#${id}`).join(', ')}</strong>
                                    </div>
                                )}

                                {transaction.remark && (
                                    <div className="transaction-detail-item transaction-detail-item--full">
                                        <span>{t('transactionDetail.remark')}</span>
                                        <strong>{transaction.remark}</strong>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TransactionDetailModal;

