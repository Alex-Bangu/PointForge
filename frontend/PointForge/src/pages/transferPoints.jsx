import { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext.jsx';
import { authenticatedFetch } from '../utils/api.js';
import { Error, Loading } from '../components';
import './transferPoints.css';

/**
 * Transfer Points Page
 * Allows regular users to transfer points to another user
 */
function TransferPoints() {
    const { user, refreshUserData } = useContext(UserContext);
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
            setReceiverError('Cannot transfer to yourself');
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
                setReceiverError('User not found');
            } else if (response.status === 400) {
                const data = await response.json();
                setReceiver(null);
                setReceiverError(data.Message || 'Cannot transfer to yourself');
            } else {
                setReceiver(null);
                setReceiverError('Failed to search user');
            }
        } catch (err) {
            setReceiver(null);
            setReceiverError('Failed to search user');
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
            setError('Please enter a valid positive amount');
            return;
        }
        
        if (!user) {
            setError('User not found. Please log in.');
            return;
        }
        
        if (amountNum > user.points) {
            setError(`Insufficient points. You have ${user.points?.toLocaleString() || 0} points available.`);
            return;
        }

        if (!receiver) {
            setError('Please enter a valid receiver UTORid');
            return;
        }

        if (receiver.id === user.id) {
            setError('Cannot transfer points to yourself');
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
        return <Loading message="Loading..." />;
    }

    return (
        <div className="transfer-points container">
            <div className="page-header">
                <h1>Transfer Points</h1>
                <p>Send points to another user</p>
            </div>

            {error && <Error error={error} />}
            
            {success && (
                <div className="success-message">
                    <p>✓ Points transferred successfully!</p>
                    <p>Your new balance: {user.points?.toLocaleString() || 0} points</p>
                </div>
            )}

            <div className="current-balance">
                <p><strong>Your Current Balance:</strong> {user.points?.toLocaleString() || 0} points</p>
            </div>

            <form className="transfer-form" onSubmit={handleSubmit}>
                <section className="form-section">
                    <h2>Receiver Information</h2>
                    <div className="form-group">
                        <label htmlFor="receiverUtorid">
                            Receiver UTORid
                            <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            id="receiverUtorid"
                            value={receiverUtorid}
                            onChange={(e) => setReceiverUtorid(e.target.value)}
                            placeholder="Enter receiver's UTORid"
                            disabled={loading}
                            required
                        />
                        {searching && <div className="searching-indicator">Searching...</div>}
                        {receiverError && <div className="error-text">{receiverError}</div>}
                        {receiver && (
                            <div className="receiver-info">
                                <p><strong>Name:</strong> {receiver.name}</p>
                                <p><strong>Current Points:</strong> {receiver.points?.toLocaleString() || 0}</p>
                                <p><strong>Email:</strong> {receiver.email}</p>
                            </div>
                        )}
                    </div>
                </section>

                <section className="form-section">
                    <h2>Transfer Details</h2>
                    <div className="form-group">
                        <label htmlFor="amount">
                            Amount to Transfer
                            <span className="required">*</span>
                        </label>
                        <input
                            type="number"
                            id="amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Enter amount"
                            disabled={loading || !receiver}
                            required
                            min="1"
                        />
                        <small className="form-hint">
                            Enter the number of points you want to transfer. You cannot transfer more than your current balance.
                        </small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="remark">
                            Message (Optional)
                        </label>
                        <textarea
                            id="remark"
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            placeholder="Add a message for the receiver"
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
                        {loading ? 'Transferring...' : 'Transfer Points'}
                    </button>
                    <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => navigate('/dashboard')}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}

export default TransferPoints;

