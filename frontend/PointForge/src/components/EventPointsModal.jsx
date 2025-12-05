import { useEffect, useState } from 'react';
import './EventEditorModal.css';

function EventPointsModal({ isOpen, event, onClose, onSubmit, busy = false, error = '' }) {
    const [target, setTarget] = useState('all');
    const [selectedUtorid, setSelectedUtorid] = useState('');
    const [amount, setAmount] = useState('');
    const [remark, setRemark] = useState('');
    const [totalCost, setTotalCost] = useState(0);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setTarget('all');
            setSelectedUtorid(event?.guests?.[0]?.utorid || '');
            setAmount('');
            setRemark('');
            setFormError('');
        }
    }, [isOpen, event]);

    useEffect(() => {
        const parsedAmount = parseInt(amount, 10);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            setTotalCost(0);
            return;
        }

        if (target === 'all') {
            setTotalCost(parsedAmount * (event?.guests?.length || 0));
        } else {
            setTotalCost(parsedAmount);
        }
    }, [amount, target, event?.guests]);

    useEffect(() => {
        if (totalCost > (event?.pointsRemain || 0)) {
            setFormError(`Total points to award (${totalCost}) cannot exceed remaining points (${event?.pointsRemain || 0}).`);
        } else {
            setFormError('');
        }
    }, [totalCost, event?.pointsRemain]);

    if (!isOpen) {
        return null;
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formError || busy) return;

        const payload = {
            amount: parseInt(amount, 10),
            remark: remark.trim(),
            type: 'event'
        };

        if (target === 'single') {
            payload.utorid = selectedUtorid;
        }

        onSubmit(payload);
    };

    return (
        <div className="event-modal-overlay" role="dialog" aria-modal="true">
            <div className="event-modal">
                <header className="event-modal__header">
                    <h3>Distribute Event Points</h3>
                    <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Close">×</button>
                </header>
                <form className="event-modal__form" onSubmit={handleSubmit}>
                    <div className="points-info">
                        <span>Points Remaining in Event: <strong>{event?.pointsRemain || 0}</strong></span>
                        <span>RSVP'd Guests: <strong>{event?.guests?.length || 0}</strong></span>
                    </div>

                    <div className="target-selection">
                        <label>
                            <input
                                type="radio"
                                name="target"
                                value="all"
                                checked={target === 'all'}
                                onChange={() => setTarget('all')}
                            />
                            Award to All Guests
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="target"
                                value="single"
                                checked={target === 'single'}
                                onChange={() => setTarget('single')}
                            />
                            Award to a Single Guest
                        </label>
                    </div>

                    {target === 'single' && (
                        <label>
                            Select Guest
                            <select
                                name="selectedUtorid"
                                value={selectedUtorid}
                                onChange={(e) => setSelectedUtorid(e.target.value)}
                                required
                            >
                                {event?.guests?.map(guest => (
                                    <option key={guest.id} value={guest.utorid}>
                                        {guest.name} ({guest.utorid})
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    <label>
                        Points to Award (per user)
                        <input
                            type="number"
                            name="amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            min="1"
                            required
                        />
                    </label>

                    <label>
                        Remark (Optional)
                        <input
                            type="text"
                            name="remark"
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                        />
                    </label>

                    <div className="total-cost-info">
                        Total Points to be Awarded: <strong>{totalCost}</strong>
                    </div>

                    {(error || formError) && <p className="modal-error">{error || formError}</p>}

                    <div className="modal-actions">
                        <button type="button" className="secondary-btn" onClick={onClose} disabled={busy}>
                            Cancel
                        </button>
                        <button type="submit" className="primary-btn" disabled={busy || !!formError || totalCost === 0}>
                            {busy ? 'Distributing...' : 'Distribute Points'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EventPointsModal;