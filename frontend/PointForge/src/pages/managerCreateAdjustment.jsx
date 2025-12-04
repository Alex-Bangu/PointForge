import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { authenticatedFetch } from '../utils/api.js';
import { Error, Loading } from '../components';
import './managerCreateAdjustment.css';

/**
 * Manager Create Adjustment Transaction Page
 * Allows managers to create adjustment transactions (add or subtract points)
 */
function ManagerCreateAdjustment() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    
    const [utorid, setUtorid] = useState('');
    const [amount, setAmount] = useState('');
    const [relatedId, setRelatedId] = useState('');
    const [remark, setRemark] = useState('');
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [createdTransaction, setCreatedTransaction] = useState(null);
    const [userError, setUserError] = useState('');
    
    const searchTimeoutRef = useRef(null);

    // Debounced user search as they type
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!utorid.trim()) {
            setUser(null);
            setUserError('');
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            await searchUser(utorid.trim());
        }, 500);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [utorid]);

    const searchUser = async (searchUtorid) => {
        setSearching(true);
        setUserError('');
        try {
            const response = await authenticatedFetch(`/users/search/${searchUtorid}`);
            if (response.ok) {
                const userData = await response.json();
                setUser(userData);
            } else if (response.status === 404) {
                setUser(null);
                setUserError(t('error.userNotFound'));
            } else {
                setUser(null);
                setUserError(t('error.failedToSearchUser'));
            }
        } catch (err) {
            setUser(null);
            setUserError(t('error.failedToSearchUser'));
        } finally {
            setSearching(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!user) {
            setError(t('error.pleaseEnterValidUtorid'));
            return;
        }

        const amountNum = parseInt(amount);
        if (isNaN(amountNum) || amountNum === 0) {
            setError(t('error.pleaseEnterValidNonZeroAmount'));
            return;
        }

        // Validate relatedId if provided
        let relatedIdNum = null;
        if (relatedId.trim()) {
            relatedIdNum = parseInt(relatedId.trim());
            if (isNaN(relatedIdNum) || relatedIdNum <= 0) {
                setError(t('error.relatedTransactionIdInvalid'));
                return;
            }
        }

        setLoading(true);

        try {
            const requestBody = {
                utorid: user.utorid.trim(),
                type: 'adjustment',
                amount: amountNum,
                remark: remark.trim() || ''
            };

            if (relatedIdNum) {
                requestBody.relatedId = relatedIdNum;
            }

            const response = await authenticatedFetch('/transactions', {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });

            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                throw new Error(text || t('error.failedToCreateAdjustment'));
            }

            if (!response.ok) {
                throw new Error(data.Message || data.message || t('error.failedToCreateAdjustment'));
            }

            setSuccess(true);
            setCreatedTransaction(data);
            
            // Reset form after 3 seconds
            setTimeout(() => {
                setUtorid('');
                setAmount('');
                setRelatedId('');
                setRemark('');
                setUser(null);
                setSuccess(false);
                setCreatedTransaction(null);
            }, 3000);
        } catch (err) {
            setError(err.message || t('error.failedToCreateAdjustment'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="manager-create-adjustment container">
            <div className="page-header">
                <h1>{t('managerAdjustment.title')}</h1>
                <p>{t('managerAdjustment.subtitle')}</p>
            </div>

            {error && <Error error={error} />}
            
            {success && createdTransaction && (
                <div className="success-message">
                    <p>✓ {t('managerAdjustment.success')}</p>
                    <p>{createdTransaction.amount > 0 ? t('managerAdjustment.pointsAdded') : t('managerAdjustment.pointsSubtracted')} {Math.abs(createdTransaction.amount)}</p>
                    <p>{t('managerAdjustment.newBalance')} {user ? (user.points + createdTransaction.amount).toLocaleString() : t('managerAdjustment.notAvailable')} {t('transactionCard.points')}</p>
                </div>
            )}

            <form className="adjustment-form" onSubmit={handleSubmit}>
                <section className="form-section">
                    <h2>{t('managerAdjustment.memberInfo')}</h2>
                    <div className="form-group">
                        <label htmlFor="utorid">
                            {t('managerAdjustment.utorid')}
                            <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            id="utorid"
                            value={utorid}
                            onChange={(e) => setUtorid(e.target.value)}
                            placeholder={t('managerAdjustment.utoridPlaceholder')}
                            disabled={loading}
                            required
                        />
                        {searching && <div className="searching-indicator">{t('managerAdjustment.searching')}</div>}
                        {userError && <div className="error-text">{userError}</div>}
                        {user && (
                            <div className="user-info">
                                <p><strong>{t('managerAdjustment.name')}</strong> {user.name}</p>
                                <p><strong>{t('managerAdjustment.currentPoints')}</strong> {user.points?.toLocaleString() || 0}</p>
                                <p><strong>{t('managerAdjustment.email')}</strong> {user.email}</p>
                            </div>
                        )}
                    </div>
                </section>

                <section className="form-section">
                    <h2>{t('managerAdjustment.adjustmentDetails')}</h2>
                    <div className="form-group">
                        <label htmlFor="amount">
                            {t('managerAdjustment.pointsAdjustment')}
                            <span className="required">*</span>
                        </label>
                        <input
                            type="number"
                            id="amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={t('managerAdjustment.amountPlaceholder')}
                            disabled={loading || !user}
                            required
                        />
                        <small className="form-hint">
                            {t('managerAdjustment.amountHint')}
                        </small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="relatedId">
                            {t('managerAdjustment.relatedId')}
                        </label>
                        <input
                            type="number"
                            id="relatedId"
                            value={relatedId}
                            onChange={(e) => setRelatedId(e.target.value)}
                            placeholder={t('managerAdjustment.relatedIdPlaceholder')}
                            disabled={loading || !user}
                        />
                        <small className="form-hint">
                            {t('managerAdjustment.relatedIdHint')}
                        </small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="remark">
                            {t('managerAdjustment.remark')}
                        </label>
                        <textarea
                            id="remark"
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            placeholder={t('managerAdjustment.remarkPlaceholder')}
                            disabled={loading || !user}
                            rows={3}
                        />
                    </div>
                </section>

                <div className="form-actions">
                    <button
                        type="submit"
                        className="submit-btn"
                        disabled={loading || !user || !amount}
                    >
                        {loading ? t('managerAdjustment.creating') : t('managerAdjustment.createAdjustment')}
                    </button>
                    <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => navigate('/dashboard/transactions')}
                        disabled={loading}
                    >
                        {t('managerAdjustment.cancel')}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ManagerCreateAdjustment;

