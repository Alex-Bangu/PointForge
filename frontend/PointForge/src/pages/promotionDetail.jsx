import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage, translatePromotionDescription } from '../contexts/LanguageContext.jsx';
import {
    Loading,
    Error,
    PromotionEditorModal
} from '../components';
import { authenticatedFetch } from '../utils/api.js';
import { formatDate } from '../utils/dateUtils.js';
import { buildPromotionPayload } from '../utils/promotionUtils.js';
import './promotions.css';

function PromotionDetail() {
    const { promotionId } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(UserContext);
    const { t } = useLanguage();
    const isManager = user?.role === 'manager' || user?.role === 'superuser';
    const isRegular = user?.role === 'regular';

    const [promotion, setPromotion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [modalBusy, setModalBusy] = useState(false);
    const [modalError, setModalError] = useState('');
    const [applying, setApplying] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if(!toast) {
            return;
        }
        const timer = setTimeout(() => setToast(''), 4000);
        return () => clearTimeout(timer);
    }, [toast]);

    useEffect(() => {
        const controller = new AbortController();
        const fetchPromotion = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await authenticatedFetch(`/promotions/${promotionId}`, {
                    signal: controller.signal
                });
                const payload = await response.json();
                if(!response.ok) {
                    throw new Error(payload.message || payload.Message || 'Unable to load promotion');
                }
                // Debug: Check if startTime is in the response
                console.log('Promotion detail from API:', payload);
                console.log('startTime value:', payload.startTime);
                console.log('startTime type:', typeof payload.startTime);
                setPromotion(payload);
            } catch (err) {
                if(err.name === 'AbortError') {
                    return;
                }
                setError(err.message || 'Unable to load promotion');
            } finally {
                setLoading(false);
            }
        };
        fetchPromotion();
        return () => controller.abort();
    }, [promotionId, refreshKey]);

    const refresh = () => setRefreshKey((key) => key + 1);

    const handleApply = async () => {
        if(!promotion) {
            return;
        }
        setApplying(true);
        setToast('');
        try {
            const response = await authenticatedFetch(`/promotions/${promotion.id}/use`, {
                method: 'POST'
            });
            const payload = await response.json();
            if(!response.ok) {
                throw new Error(payload.message || 'Unable to apply promotion');
            }
            setToast(payload.message || 'Promotion applied');
            refresh();
        } catch (err) {
            setError(err.message || 'Unable to apply promotion');
        } finally {
            setApplying(false);
        }
    };

    const handleDelete = async () => {
        if(!promotion) {
            return;
        }
        const confirmed = window.confirm('Delete this promotion? This cannot be undone.');
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
                    throw new Error(payload.message || payload.Message || 'Unable to delete promotion');
                }
            }
            navigate('/dashboard/promotions');
        } catch (err) {
            setError(err.message || 'Unable to delete promotion');
        }
    };

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
                throw new Error(body.message || body.Message || 'Unable to save promotion');
            }
            setModalOpen(false);
            setToast('Promotion updated');
            refresh();
        } catch (err) {
            setModalError(err.message || 'Unable to save promotion');
        } finally {
            setModalBusy(false);
        }
    };

    if(loading) {
        return <Loading message="Loading promotion..." />;
    }

    if(error) {
        return <Error error={error} container />;
    }

    if(!promotion) {
        return null;
    }

    const statusKey = promotion.hasEnded ? 'ended' : promotion.isUpcoming ? 'upcoming' : 'active';
    const rateDisplay = promotion.rate ? `${Math.round(promotion.rate * 100)}% bonus` : 'No bonus rate';
    const pointsDisplay = promotion.points ? `${promotion.points} pts` : 'No flat points';
    const minSpending = promotion.minSpending ? `$${promotion.minSpending}` : 'No minimum spending';
    const canApply = isRegular && promotion.isOneTime;
    const applyDisabled = !promotion.usable || promotion.isUpcoming || promotion.hasEnded || promotion.alreadyUsed;

    return (
        <div className="promotions-page container">
            <div className="promotion-detail-card">
                <div className="promotion-detail-header">
                    <button className="back-link" onClick={() => navigate(-1)}>← Back</button>
                    <div className="card-badges">
                        <span className={`promo-badge status-${statusKey}`}>{statusKey}</span>
                        <span className="promo-badge type">{promotion.isOneTime ? 'One-Time' : 'Automatic'}</span>
                        {toast && <span className="toast">{toast}</span>}
                    </div>
                </div>
                <h2>{promotion.name}</h2>
                <p>{translatePromotionDescription(promotion.description, t)}</p>
                <div className="promotion-meta-grid">
                    <div className="promotion-meta-item">
                        <span>Starts</span>
                        <strong>{promotion.startTime ? formatDate(promotion.startTime) : 'N/A'}</strong>
                    </div>
                    <div className="promotion-meta-item">
                        <span>Ends</span>
                        <strong>{promotion.endTime ? formatDate(promotion.endTime) : 'N/A'}</strong>
                    </div>
                    <div className="promotion-meta-item">
                        <span>Reward</span>
                        <strong>{rateDisplay} · {pointsDisplay}</strong>
                    </div>
                    <div className="promotion-meta-item">
                        <span>Minimum spending</span>
                        <strong>{minSpending}</strong>
                    </div>
                </div>
                <div className="promotion-cta">
                    <button className="secondary-btn" onClick={() => navigate('/dashboard/promotions')}>
                        View all promotions
                    </button>
                    {canApply && (
                        <button className="primary-btn" disabled={applyDisabled || applying} onClick={handleApply}>
                            {applyDisabled ? 'Unavailable' : applying ? 'Applying...' : 'Apply promotion'}
                        </button>
                    )}
                    {isManager && (
                        <>
                            <button className="secondary-btn" onClick={() => setModalOpen(true)}>
                                Edit promotion
                            </button>
                            <button className="secondary-btn" onClick={handleDelete}>
                                Delete promotion
                            </button>
                        </>
                    )}
                </div>
                <div className="promotion-detail-footer">
                    <span>{promotion.alreadyUsed ? 'You have already used this promotion.' : 'You have not used this promotion yet.'}</span>
                    <span>{promotion.hasEnded ? 'This promotion has ended.' : promotion.isUpcoming ? 'This promotion starts soon.' : promotion.usable ? 'Eligible now.' : 'Not eligible now.'}</span>
                    {isManager && (
                        <span>{promotion.userCount || 0} users have redeemed this promotion.</span>
                    )}
                </div>
            </div>

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
    );
}

export default PromotionDetail;

