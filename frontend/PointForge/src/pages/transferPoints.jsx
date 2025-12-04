import { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { authenticatedFetch } from '../utils/api.js';
import { Error, Loading } from '../components';
import './transferPoints.css';

/**
 * Transfer Points Page
 * Allows regular users to transfer points to another user
 */
function TransferPoints() {
    const { user, refreshUserData } = useContext(UserContext);
    const { t } = useLanguage();
    const navigate = useNavigate();
    
    const [receiverUtorid, setReceiverUtorid] = useState('');
    const [amount, setAmount] = useState('');
    const [remark, setRemark] = useState('');
    const [receiver, setReceiver] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [receiverError, setReceiverError] = useState('');
    
    const searchTimeoutRef = useRef(null);

    // Debounced receiver search as they type
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!receiverUtorid.trim()) {
            setReceiver(null);
            setReceiverError('');
            return;
        }

        // Don't search if it's the same as current user
        if (receiverUtorid.trim().toLowerCase() === user?.utorid?.toLowerCase()) {
            setReceiver(null);
            setReceiverError(t('transfer.cannotTransferToSelf'));
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            await searchReceiver(receiverUtorid.trim());
        }, 500);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [receiverUtorid, user?.utorid]);

    const searchReceiver = async (searchUtorid) => {
        setSearching(true);
        setReceiverError('');
        try {
            const response = await authenticatedFetch(`/users/search-transfer/${searchUtorid}`);
            if (response.ok) {
                const userData = await response.json();
                setReceiver(userData);
            } else if (response.status === 404) {
                setReceiver(null);
                setReceiverError(t('transfer.userNotFound'));
            } else if (response.status === 400) {
                const data = await response.json();
                setReceiver(null);
                setReceiverError(data.Message || t('transfer.cannotTransferToSelf'));
            } else {
                setReceiver(null);
                setReceiverError(t('transfer.failedToSearch'));
            }
        } catch (err) {
            setReceiver(null);
            setReceiverError(t('transfer.failedToSearch'));
        } finally {
            setSearching(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        
        const amountNum = parseInt(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            setError(t('transfer.pleaseEnterValidAmount'));
            return;
        }
        
        if (!user) {
            setError(t('error.unableToLoad'));
            return;
        }
        
        if (amountNum > user.points) {
            setError(`${t('transfer.insufficientPoints')} ${user.points?.toLocaleString() || 0} ${t('transfer.pointsAvailable')}`);
            return;
        }

        if (!receiver) {
            setError(t('transfer.pleaseEnterValidReceiver'));
            return;
        }

        if (receiver.id === user.id) {
            setError(t('transfer.cannotTransferToYourself'));
            return;
        }
        
        setLoading(true);
        try {
            const response = await authenticatedFetch('/transactions', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'transfer',
                    receiverUtorid: receiver.utorid.trim(),
                    amount: amountNum,
                    remark: remark.trim() || ''
                })
            });

            // authenticatedFetch handles 401 automatically, but we can still throw for local error handling
            if (response.status === 401) {
                throw new Error('Session expired. Please log in again.');
            }

            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                throw new Error(text || 'Failed to transfer points');
            }

            if (!response.ok) {
                throw new Error(data.Message || data.message || 'Failed to transfer points');
            }
            
            // Refresh user data to update points
            if (refreshUserData) {
                await refreshUserData();
            }
            
            setSuccess(true);
            
            // Reset form after 3 seconds
            setTimeout(() => {
                setReceiverUtorid('');
                setAmount('');
                setRemark('');
                setReceiver(null);
                setSuccess(false);
            }, 3000);
        } catch (err) {
            setError(err.message || 'Failed to transfer points');
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return <Loading message={t('common.loading')} />;
    }

    return (
        <div className="transfer-points container">
            <div className="page-header">
                <h1>{t('transfer.title')}</h1>
                <p>{t('transfer.subtitle')}</p>
            </div>

            {error && <Error error={error} />}
            
            {success && (
                <div className="success-message">
                    <p>{t('transfer.success')}</p>
                    <p>{t('transfer.newBalance')} {user.points?.toLocaleString() || 0} {t('transfer.points')}</p>
                </div>
            )}

            <div className="current-balance">
                <p><strong>{t('transfer.currentBalance')}</strong> {user.points?.toLocaleString() || 0} {t('transfer.points')}</p>
            </div>

            <form className="transfer-form" onSubmit={handleSubmit}>
                <section className="form-section">
                    <h2>{t('transfer.receiverInfo')}</h2>
                    <div className="form-group">
                        <label htmlFor="receiverUtorid">
                            {t('transfer.receiverUtorid')}
                            <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            id="receiverUtorid"
                            value={receiverUtorid}
                            onChange={(e) => setReceiverUtorid(e.target.value)}
                            placeholder={t('transfer.receiverPlaceholder')}
                            disabled={loading}
                            required
                        />
                        {searching && <div className="searching-indicator">{t('transfer.searching')}</div>}
                        {receiverError && <div className="error-text">{receiverError}</div>}
                        {receiver && (
                            <div className="receiver-info">
                                <p><strong>{t('transfer.receiverName')}</strong> {receiver.name}</p>
                                <p><strong>{t('transfer.receiverCurrentPoints')}</strong> {receiver.points?.toLocaleString() || 0}</p>
                                <p><strong>{t('transfer.receiverEmail')}</strong> {receiver.email}</p>
                            </div>
                        )}
                    </div>
                </section>

                <section className="form-section">
                    <h2>{t('transfer.transferDetails')}</h2>
                    <div className="form-group">
                        <label htmlFor="amount">
                            {t('transfer.amountToTransfer')}
                            <span className="required">*</span>
                        </label>
                        <input
                            type="number"
                            id="amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={t('transfer.amountPlaceholder')}
                            disabled={loading || !receiver}
                            required
                            min="1"
                        />
                        <small className="form-hint">
                            {t('transfer.amountHint')}
                        </small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="remark">
                            {t('transfer.message')}
                        </label>
                        <textarea
                            id="remark"
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            placeholder={t('transfer.messagePlaceholder')}
                            disabled={loading || !receiver}
                            rows={3}
                        />
                    </div>
                </section>

                <div className="form-actions">
                    <button
                        type="submit"
                        className="submit-btn"
                        disabled={loading || !receiver || !amount}
                    >
                        {loading ? t('transfer.transferring') : t('transfer.transferPoints')}
                    </button>
                    <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => navigate('/dashboard')}
                        disabled={loading}
                    >
                        {t('transfer.cancel')}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default TransferPoints;

