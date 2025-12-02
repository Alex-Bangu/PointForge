import { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext.jsx';
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
    const [transaction, setTransaction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchRedemption = async () => {
            if (!transactionId) {
                // If no transactionId, fetch all redemptions and show the most recent unprocessed one
                try {
                    const response = await authenticatedFetch('/users/me/transactions?type=redemption&limit=50');
                    
                    if (response.status === 401) {
                        localStorage.removeItem('token');
                        window.dispatchEvent(new CustomEvent('tokenChange', { detail: { action: 'logout' } }));
                        throw new Error('Session expired. Please log in again.');
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
                        setError('No unprocessed redemption requests found');
                    }
                } catch (err) {
                    setError(err.message || 'Failed to load redemption requests');
                } finally {
                    setLoading(false);
                }
            } else {
                // Fetch specific transaction
                try {
                    const response = await authenticatedFetch(`/users/me/transactions?limit=1000`);
                    
                    if (response.status === 401) {
                        localStorage.removeItem('token');
                        window.dispatchEvent(new CustomEvent('tokenChange', { detail: { action: 'logout' } }));
                        throw new Error('Session expired. Please log in again.');
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
                        setError('Redemption request not found');
                    }
                } catch (err) {
                    setError(err.message || 'Failed to load redemption request');
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
                <Loading message="Loading redemption request..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="redemption-qr-page container">
                <Error error={error} />
                <div className="redemption-qr-actions">
                    <button className="secondary-btn" onClick={() => navigate('/dashboard/redemption')}>
                        Create New Request
                    </button>
                    <button className="secondary-btn" onClick={() => navigate('/dashboard')}>
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (!transaction) {
        return (
            <div className="redemption-qr-page container">
                <Error error="No redemption request found" />
                <div className="redemption-qr-actions">
                    <button className="secondary-btn" onClick={() => navigate('/dashboard/redemption')}>
                        Create New Request
                    </button>
                </div>
            </div>
        );
    }

    const isProcessed = transaction.processed;

    return (
        <div className="redemption-qr-page container">
            <div className="redemption-qr-header">
                <h1>Redemption QR Code</h1>
                <p>
                    {isProcessed 
                        ? 'This redemption has been processed' 
                        : 'Show this QR code to a cashier to process your redemption'}
                </p>
            </div>

            <div className="redemption-qr-content">
                {!isProcessed ? (
                    <>
                        <QRCodeDisplay 
                            value={String(transaction.id)} 
                            label="Transaction ID"
                            size={280}
                        />
                        
                        <div className="redemption-qr-info">
                            <div className="status-badge status-badge--pending">
                                Pending
                            </div>
                            
                            <div className="redemption-details">
                                <div className="detail-item">
                                    <span className="detail-label">Transaction ID:</span>
                                    <span className="detail-value">#{transaction.id}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">Points to Redeem:</span>
                                    <span className="detail-value">{Math.abs(transaction.redeemed || transaction.amount || 0).toLocaleString()} pts</span>
                                </div>
                                {transaction.remark && (
                                    <div className="detail-item">
                                        <span className="detail-label">Remarks:</span>
                                        <span className="detail-value">{transaction.remark}</span>
                                    </div>
                                )}
                            </div>

                            <p className="redemption-qr-instructions">
                                A cashier can scan this QR code to quickly access and process your redemption request.
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="redemption-qr-processed">
                        <div className="status-badge status-badge--processed">
                            Processed
                        </div>
                        <p className="processed-message">
                            This redemption request has been successfully processed.
                        </p>
                        <div className="redemption-details">
                            <div className="detail-item">
                                <span className="detail-label">Transaction ID:</span>
                                <span className="detail-value">#{transaction.id}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Points Redeemed:</span>
                                <span className="detail-value">{Math.abs(transaction.redeemed || transaction.amount || 0).toLocaleString()} pts</span>
                            </div>
                            {transaction.processedBy && (
                                <div className="detail-item">
                                    <span className="detail-label">Processed By:</span>
                                    <span className="detail-value">{transaction.processedBy}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="redemption-qr-actions">
                    <button className="secondary-btn" onClick={() => navigate('/dashboard/redemption')}>
                        {isProcessed ? 'Create New Request' : 'Request Another Redemption'}
                    </button>
                    <button className="secondary-btn" onClick={() => navigate('/dashboard')}>
                        Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}

export default RedemptionQR;

