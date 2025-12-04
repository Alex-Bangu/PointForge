import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { authenticatedFetch } from '../utils/api.js';
import { Error, Loading } from '../components';
import './redemption.css';

/**
 * Redemption Request Page
 * Allows users to create a redemption request for their points
 */
function Redemption() {
    const { user, loading: userLoading, error: userError, refreshUserData } = useContext(UserContext);
    const { t } = useLanguage();
    const navigate = useNavigate();
    
    const [amount, setAmount] = useState('');
    const [remark, setRemark] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (userLoading) {
        return <Loading message={t('common.loading')} />;
    }

    if (userError) {
        return <Error error={userError} />;
    }

    if (!user) {
        return <Error error={t('error.unableToLoad')} />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        const amountNum = parseInt(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            setError(t('redemption.pleaseEnterValidAmount'));
            return;
        }
        
        if (amountNum > user.points) {
            setError(`${t('transfer.insufficientPoints')} ${user.points?.toLocaleString() || 0} ${t('transfer.pointsAvailable')}`);
            return;
        }
        
        setLoading(true);
        try {
            const response = await authenticatedFetch('/users/me/transactions', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'redemption',
                    amount: amountNum,
                    remark: remark.trim() || ''
                })
            });

            // authenticatedFetch handles 401 automatically
            if (response.status === 401) {
                throw new Error(t('redemption.sessionExpired'));
            }

            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                throw new Error(text || t('redemption.failedToCreate'));
            }

            if (!response.ok) {
                throw new Error(data.Message || data.message || t('redemption.failedToCreate'));
            }
            
            // Refresh user data to update points
            if (refreshUserData) {
                await refreshUserData();
            }
            
            // Redirect to QR code page
            navigate(`/dashboard/redemption-qr/${data.id}`);
        } catch (err) {
            setError(err.message || t('redemption.failedToCreate'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="redemption-page container">
            <div className="redemption-content">
                <div className="redemption-header">
                    <h1>{t('redemption.title')}</h1>
                    <p>{t('redemption.subtitle')}</p>
                </div>
                <div className="redemption-info">
                    <div className="points-display">
                        <span className="points-label">{t('redemption.availablePoints')}</span>
                        <span className="points-value">{user.points?.toLocaleString() || 0}</span>
                    </div>
                </div>

                {error && <Error error={error} />}

                <form className="redemption-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="amount">
                            {t('redemption.pointsToRedeem')}
                            <span className="required">*</span>
                        </label>
                        <input
                            type="number"
                            id="amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={t('redemption.pointsToRedeem')}
                            min="1"
                            max={user.points || 0}
                            required
                            disabled={loading}
                        />
                        <small className="form-hint">
                            {t('redemption.maximum')} {user.points?.toLocaleString() || 0} {t('redemption.points')}
                        </small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="remark">{t('redemption.remarks')}</label>
                        <textarea
                            id="remark"
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            placeholder={t('redemption.remarksPlaceholder')}
                            rows="3"
                            disabled={loading}
                        />
                    </div>

                    <div className="form-actions">
                        <button 
                            type="submit" 
                            className="primary-btn"
                            disabled={loading || !amount || parseInt(amount) <= 0}
                        >
                            {loading ? t('redemption.creatingRequest') : t('redemption.createRequest')}
                        </button>
                        <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => navigate('/dashboard')}
                            disabled={loading}
                        >
                            {t('redemption.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Redemption;

