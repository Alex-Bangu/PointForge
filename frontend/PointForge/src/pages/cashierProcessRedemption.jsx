import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../utils/api.js';
import { Error, Loading } from '../components';
import './cashierProcessRedemption.css';

/**
 * Cashier Process Redemption Page
 * Allows cashiers to process redemption requests by transaction ID or QR code
 */
function CashierProcessRedemption() {
    const navigate = useNavigate();
    
    const [transactionId, setTransactionId] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Process redemption directly by transaction ID
    // Since cashiers can't fetch transaction details, we'll process directly
    // The backend will validate the transaction
    const handleProcessByTransactionId = async () => {
        if (!transactionId.trim()) {
            setError('Please enter a transaction ID');
            return;
        }

        const id = parseInt(transactionId.trim());
        if (isNaN(id)) {
            setError('Please enter a valid transaction ID');
            return;
        }

        setProcessing(true);
        setError('');
        setSuccess(false);

        try {
            const response = await authenticatedFetch(`/transactions/${id}/processed`, {
                method: 'PATCH',
                body: JSON.stringify({ processed: true })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.Message || data.message || 'Failed to process redemption. Make sure the transaction ID is correct and the redemption is pending.');
            }

            setSuccess(true);
            setTransactionId('');
            
            // Reset after 3 seconds
            setTimeout(() => {
                setSuccess(false);
            }, 3000);
        } catch (err) {
            setError(err.message || 'Failed to process redemption');
        } finally {
            setProcessing(false);
        }
    };


    return (
        <div className="cashier-process-redemption container">
            <div className="page-header">
                <h1>Process Redemption Request</h1>
                <p>Enter a transaction ID or scan a QR code to process a redemption</p>
            </div>

            {error && <Error error={error} />}
            
            {success && (
                <div className="success-message">
                    <p>✓ Redemption processed successfully!</p>
                    <p>Points have been deducted from the member's account.</p>
                </div>
            )}

            <div className="redemption-form">
                <section className="form-section">
                    <h2>Process Redemption</h2>
                    <p className="section-description">
                        Enter the transaction ID from the member's redemption request QR code, 
                        or scan the QR code directly.
                    </p>
                    <div className="form-group">
                        <label htmlFor="transactionId">
                            Transaction ID
                            <span className="required">*</span>
                        </label>
                        <div className="search-group">
                            <input
                                type="text"
                                id="transactionId"
                                value={transactionId}
                                onChange={(e) => setTransactionId(e.target.value)}
                                placeholder="Enter transaction ID"
                                disabled={processing}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !processing && transactionId.trim()) {
                                        e.preventDefault();
                                        handleProcessByTransactionId();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleProcessByTransactionId}
                                disabled={processing || !transactionId.trim()}
                                className="process-btn"
                            >
                                {processing ? 'Processing...' : 'Process Redemption'}
                            </button>
                        </div>
                        <small className="form-hint">
                            The backend will validate the transaction and process the redemption if valid.
                            Make sure the member is present and you have verified the transaction ID.
                        </small>
                    </div>
                </section>
            </div>

            <div className="page-actions">
                <button
                    className="secondary-btn"
                    onClick={() => navigate('/dashboard')}
                >
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
}

export default CashierProcessRedemption;

