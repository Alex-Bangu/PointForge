/**
 * Success Modal Component
 * 
 * A simple popup modal that displays a success message.
 * Used to show confirmation messages like "Promotion applied" in a prominent way.
 * 
 * Features:
 * - Dark overlay background (same as promotion detail modal)
 * - Centered modal with success message
 * - Auto-closes after a few seconds or can be closed manually
 * - Click outside to close
 */

import { useEffect } from 'react';
import './SuccessModal.css';

/**
 * Success Modal
 * @param {boolean} isOpen - Whether the modal is currently open
 * @param {string} message - The success message to display
 * @param {function} onClose - Callback to close the modal
 * @param {number} autoCloseDelay - Time in milliseconds before auto-closing (default: 3000)
 */
function SuccessModal({ isOpen, message, onClose, autoCloseDelay = 3000 }) {
    // Don't render if modal is closed
    if(!isOpen) {
        return null;
    }

    // Auto-close after delay
    useEffect(() => {
        if(!isOpen || !message) {
            return;
        }
        const timer = setTimeout(() => {
            onClose();
        }, autoCloseDelay);
        return () => clearTimeout(timer);
    }, [isOpen, message, autoCloseDelay, onClose]);

    // Handle clicking outside modal to close it
    const handleOverlayClick = (e) => {
        if(e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="success-modal-overlay" onClick={handleOverlayClick}>
            <div className="success-modal" onClick={(e) => e.stopPropagation()}>
                <button className="success-modal-close" onClick={onClose} aria-label="Close">×</button>
                <div className="success-modal-content">
                    <div className="success-icon">✓</div>
                    <h3>Success!</h3>
                    <p>{message}</p>
                </div>
            </div>
        </div>
    );
}

export default SuccessModal;

