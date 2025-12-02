/**
 * Confirmation Modal Component
 * 
 * A popup modal that asks the user to confirm an action before proceeding.
 * Used for important actions like applying promotions that can't be undone.
 * 
 * Features:
 * - Dark overlay background (same as other modals)
 * - Centered modal with confirmation message
 * - Confirm and Cancel buttons
 * - Click outside to close (cancels action)
 */

import './ConfirmModal.css';

/**
 * Confirmation Modal
 * @param {boolean} isOpen - Whether the modal is currently open
 * @param {string} title - The title/question to display
 * @param {string} message - Additional message or details
 * @param {string} confirmText - Text for the confirm button (default: "Confirm")
 * @param {string} cancelText - Text for the cancel button (default: "Cancel")
 * @param {function} onConfirm - Callback when user confirms
 * @param {function} onCancel - Callback when user cancels
 * @param {function} onEventUpdated
 */
function ConfirmModal({ isOpen, title, message, confirmText = "Confirm", cancelText = "Cancel", onConfirm, onCancel, onEventUpdated = null }) {
    // Don't render if modal is closed
    if(!isOpen) {
        return null;
    }

    // Handle clicking outside modal to cancel
    const handleOverlayClick = (e) => {
        if(e.target === e.currentTarget) {
            onCancel();
        }
    };

    const handleConfirm = () => {
        onConfirm();
        if(onEventUpdated) onEventUpdated();
    }

    return (
        <div className="confirm-modal-overlay" onClick={handleOverlayClick}>
            <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-modal-content">
                    <h3>{title}</h3>
                    {message && <p>{message}</p>}
                </div>
                <div className="confirm-modal-actions">
                    <button className="secondary-btn" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button className="primary-btn" onClick={handleConfirm}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmModal;

