import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext.jsx';
import { authenticatedFetch } from '../utils/api.js';
import { Error, Loading } from '../components';
import './redemption.css';

/**
 * Redemption Request Page
 * Allows users to create a redemption request for their points
 */
function Redemption() {
    const { user, loading: userLoading, error: userError, refreshUserData } = useContext(UserContext);
    const navigate = useNavigate();
    
    const [amount, setAmount] = useState('');
    const [remark, setRemark] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (userLoading) {
        return <Loading message="Loading..." />;
    }

    if (userError) {
        return <Error error={userError} />;
    }

    if (!user) {
        return <Error error="User not found. Please log in." />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        const amountNum = parseInt(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            setError('Please enter a valid positive amount');
            return;
        }
        
        if (amountNum > user.points) {
            setError(`Insufficient points. You have ${user.points?.toLocaleString() || 0} points available.`);
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
                const text = await response.text();
                throw new Error(text || 'Failed to create redemption request');
            }

            if (!response.ok) {
                throw new Error(data.Message || data.message || 'Failed to create redemption request');
            }
            
            // Refresh user data to update points
            if (refreshUserData) {
                await refreshUserData();
            }
            
            // Redirect to QR code page
            navigate(`/dashboard/redemption-qr/${data.id}`);
        } catch (err) {
            setError(err.message || 'Failed to create redemption request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="redemption-page container">
            <div className="redemption-header">
                <h1>Request Redemption</h1>
                <p>Convert your points into rewards</p>
            </div>

            <div className="redemption-content">
                <div className="redemption-info">
                    <div className="points-display">
                        <span className="points-label">Available Points</span>
                        <span className="points-value">{user.points?.toLocaleString() || 0}</span>
                    </div>
                </div>

                {error && <Error error={error} />}

                <form className="redemption-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="amount">
                            Points to Redeem
                            <span className="required">*</span>
                        </label>
                        <input
                            type="number"
                            id="amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Enter amount"
                            min="1"
                            max={user.points || 0}
                            required
                            disabled={loading}
                        />
                        <small className="form-hint">
                            Maximum: {user.points?.toLocaleString() || 0} points
                        </small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="remark">Remarks (Optional)</label>
                        <textarea
                            id="remark"
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            placeholder="Add any additional notes..."
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
                            {loading ? 'Creating Request...' : 'Create Redemption Request'}
                        </button>
                        <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => navigate('/dashboard')}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Redemption;

