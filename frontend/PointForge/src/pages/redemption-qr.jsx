import { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { authenticatedFetch } from '../utils/api.js';
import { QRCodeDisplay, Loading, Error } from '../components';
import './redemption-qr.css';

/**
 * Redemption QR Code Display Page
 * Shows QR code for unprocessed redemption requests
 */
function RedemptionQR() {
    const { transactionId } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(UserContext);
    const { t } = useLanguage();
    const [transaction, setTransaction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchRedemption = async () => {
            if (!transactionId) {
                // If no transactionId, fetch all redemptions and show the most recent unprocessed one
                try {
                    const response = await authenticatedFetch('/users/me/transactions?type=redemption&limit=50');
                    
                    // authenticatedFetch handles 401 automatically
                    if (response.status === 401) {
                        throw new Error(t('redemptionQR.sessionExpired'));
                    }

                    const contentType = response.headers.get('content-type');
                    let data;
                    if (contentType && contentType.includes('application/json')) {
                        data = await response.json();
                    } else {
                        throw new Error('Invalid response');
                    }

                    if (!response.ok) {
                        throw new Error(data.message || data.Message || 'Failed to load redemptions');
                    }

                    // Find the most recent unprocessed redemption
                    const unprocessed = data.results?.find(t => 
                        t.type === 'redemption' && !t.processed
                    );

                    if (unprocessed) {
                        setTransaction(unprocessed);
                    } else {
                        setError(t('redemptionQR.noUnprocessed'));
                    }
                } catch (err) {
                    setError(err.message || t('redemptionQR.failedToLoad'));
                } finally {
                    setLoading(false);
                }
            } else {
                // Fetch specific transaction
                try {
                    const response = await authenticatedFetch(`/users/me/transactions?limit=1000`);
                    
                    // authenticatedFetch handles 401 automatically
                    if (response.status === 401) {
                        throw new Error(t('redemptionQR.sessionExpired'));
                    }

                    const contentType = response.headers.get('content-type');
                    let data;
                    if (contentType && contentType.includes('application/json')) {
                        data = await response.json();
                    } else {
                        throw new Error('Invalid response');
                    }

                    if (!response.ok) {
                        throw new Error(data.message || data.Message || 'Failed to load transaction');
                    }

                    const found = data.results?.find(t => t.id === parseInt(transactionId));
                    if (found) {
                        setTransaction(found);
                    } else {
                        setError(t('redemptionQR.notFound'));
                    }
                } catch (err) {
                    setError(err.message || t('redemptionQR.failedToLoadRequest'));
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchRedemption();
    }, [transactionId]);

    // Poll for updates if transaction is unprocessed
    useEffect(() => {
        if (!transaction || transaction.processed) {
            return;
        }

        const intervalId = setInterval(async () => {
            try {
                const response = await authenticatedFetch(`/users/me/transactions?limit=1000`);
                if (response.ok) {
                    const data = await response.json();
                    const updated = data.results?.find(t => t.id === transaction.id);
                    if (updated && updated.processed) {
                        setTransaction(updated);
                    }
                }
            } catch (err) {
                // Silently fail on polling errors
            }
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(intervalId);
    }, [transaction?.id, transaction?.processed]);

    if (loading) {
        return (
            <div className="redemption-qr-page container">
                <Loading message={t('redemptionQR.loading')} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="redemption-qr-page container">
                <Error error={error} />
                <div className="redemption-qr-actions">
                    <button className="secondary-btn" onClick={() => navigate('/dashboard/redemption')}>
                        {t('redemptionQR.createNewRequest')}
                    </button>
                    <button className="secondary-btn" onClick={() => navigate('/dashboard')}>
                        {t('redemptionQR.backToDashboard')}
                    </button>
                </div>
            </div>
        );
    }

    if (!transaction) {
        return (
            <div className="redemption-qr-page container">
                <Error error={t('redemptionQR.noRequestFound')} />
                <div className="redemption-qr-actions">
                    <button className="secondary-btn" onClick={() => navigate('/dashboard/redemption')}>
                        {t('redemptionQR.createNewRequest')}
                    </button>
                </div>
            </div>
        );
    }

    const isProcessed = transaction.processed;

    return (
        <div className="redemption-qr-page container">
            <div className="redemption-qr-header">
                <h1>{t('redemptionQR.title')}</h1>
                <p>
                    {isProcessed 
                        ? t('redemptionQR.processed')
                        : t('redemptionQR.pending')}
                </p>
            </div>

            <div className="redemption-qr-content">
                {!isProcessed ? (
                    <>
                        <QRCodeDisplay 
                            value={String(transaction.id)} 
                            label={t('redemptionQR.transactionId')}
                            size={280}
                        />
                        
                        <div className="redemption-qr-info">
                            <div className="status-badge status-badge--pending">
                                {t('redemptionQR.pendingStatus')}
                            </div>
                            
                            <div className="redemption-details">
                                <div className="detail-item">
                                    <span className="detail-label">{t('redemptionQR.transactionIdLabel')}</span>
                                    <span className="detail-value">#{transaction.id}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">{t('redemptionQR.pointsToRedeem')}</span>
                                    <span className="detail-value">{Math.abs(transaction.redeemed || transaction.amount || 0).toLocaleString()} {t('transactionCard.points')}</span>
                                </div>
                                {transaction.remark && (
                                    <div className="detail-item">
                                        <span className="detail-label">{t('redemptionQR.remarks')}</span>
                                        <span className="detail-value">{transaction.remark}</span>
                                    </div>
                                )}
                            </div>

                            <p className="redemption-qr-instructions">
                                {t('redemptionQR.instructions')}
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="redemption-qr-processed">
                        <div className="status-badge status-badge--processed">
                            {t('redemptionQR.processedStatus')}
                        </div>
                        <p className="processed-message">
                            {t('redemptionQR.processedMessage')}
                        </p>
                        <div className="redemption-details">
                            <div className="detail-item">
                                <span className="detail-label">{t('redemptionQR.transactionIdLabel')}</span>
                                <span className="detail-value">#{transaction.id}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">{t('redemptionQR.pointsRedeemed')}</span>
                                <span className="detail-value">{Math.abs(transaction.redeemed || transaction.amount || 0).toLocaleString()} {t('transactionCard.points')}</span>
                            </div>
                            {transaction.processedBy && (
                                <div className="detail-item">
                                    <span className="detail-label">{t('redemptionQR.processedBy')}</span>
                                    <span className="detail-value">{transaction.processedBy}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="redemption-qr-actions">
                    <button className="secondary-btn" onClick={() => navigate('/dashboard/redemption')}>
                        {isProcessed ? t('redemptionQR.createNewRequest') : t('redemptionQR.requestAnother')}
                    </button>
                    <button className="secondary-btn" onClick={() => navigate('/dashboard')}>
                        {t('redemptionQR.backToDashboard')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default RedemptionQR;

