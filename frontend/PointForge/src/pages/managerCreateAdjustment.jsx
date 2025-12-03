import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../utils/api.js';
import { Error, Loading } from '../components';
import './managerCreateAdjustment.css';

/**
 * Manager Create Adjustment Transaction Page
 * Allows managers to create adjustment transactions (add or subtract points)
 */
function ManagerCreateAdjustment() {
    const navigate = useNavigate();
    
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
                setUserError('User not found');
            } else {
                setUser(null);
                setUserError('Failed to search user');
            }
        } catch (err) {
            setUser(null);
            setUserError('Failed to search user');
        } finally {
            setSearching(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!user) {
            setError('Please enter a valid UTORid and wait for member verification');
            return;
        }

        const amountNum = parseInt(amount);
        if (isNaN(amountNum) || amountNum === 0) {
            setError('Please enter a valid non-zero amount');
            return;
        }

        // Validate relatedId if provided
        let relatedIdNum = null;
        if (relatedId.trim()) {
            relatedIdNum = parseInt(relatedId.trim());
            if (isNaN(relatedIdNum) || relatedIdNum <= 0) {
                setError('Related Transaction ID must be a valid positive integer');
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
                throw new Error(text || 'Failed to create adjustment transaction');
            }

            if (!response.ok) {
                throw new Error(data.Message || data.message || 'Failed to create adjustment transaction');
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
            setError(err.message || 'Failed to create adjustment transaction');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="manager-create-adjustment container">
            <div className="page-header">
                <h1>Create Adjustment Transaction</h1>
                <p>Add or subtract points from a user's account</p>
            </div>

            {error && <Error error={error} />}
            
            {success && createdTransaction && (
                <div className="success-message">
                    <p>✓ Adjustment transaction created successfully!</p>
                    <p>Points {createdTransaction.amount > 0 ? 'added' : 'subtracted'}: {Math.abs(createdTransaction.amount)}</p>
                    <p>User's new balance: {user ? (user.points + createdTransaction.amount).toLocaleString() : 'N/A'} points</p>
                </div>
            )}

            <form className="adjustment-form" onSubmit={handleSubmit}>
                <section className="form-section">
                    <h2>Member Information</h2>
                    <div className="form-group">
                        <label htmlFor="utorid">
                            UTORid
                            <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            id="utorid"
                            value={utorid}
                            onChange={(e) => setUtorid(e.target.value)}
                            placeholder="Enter member UTORid"
                            disabled={loading}
                            required
                        />
                        {searching && <div className="searching-indicator">Searching...</div>}
                        {userError && <div className="error-text">{userError}</div>}
                        {user && (
                            <div className="user-info">
                                <p><strong>Name:</strong> {user.name}</p>
                                <p><strong>Current Points:</strong> {user.points?.toLocaleString() || 0}</p>
                                <p><strong>Email:</strong> {user.email}</p>
                            </div>
                        )}
                    </div>
                </section>

                <section className="form-section">
                    <h2>Adjustment Details</h2>
                    <div className="form-group">
                        <label htmlFor="amount">
                            Points Adjustment
                            <span className="required">*</span>
                        </label>
                        <input
                            type="number"
                            id="amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Enter amount (positive to add, negative to subtract)"
                            disabled={loading || !user}
                            required
                        />
                        <small className="form-hint">
                            Enter a positive number to add points, or a negative number to subtract points.
                            Example: 100 (adds 100 points), -50 (subtracts 50 points)
                        </small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="relatedId">
                            Related Transaction ID (Optional)
                        </label>
                        <input
                            type="number"
                            id="relatedId"
                            value={relatedId}
                            onChange={(e) => setRelatedId(e.target.value)}
                            placeholder="Transaction ID this adjustment relates to"
                            disabled={loading || !user}
                        />
                        <small className="form-hint">
                            If this adjustment is correcting or related to a specific transaction, enter its ID here.
                        </small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="remark">
                            Remark (Optional)
                        </label>
                        <textarea
                            id="remark"
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            placeholder="Add a note about this adjustment"
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
                        {loading ? 'Creating...' : 'Create Adjustment'}
                    </button>
                    <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => navigate('/dashboard/transactions')}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ManagerCreateAdjustment;

