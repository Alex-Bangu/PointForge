import { useContext, useEffect, useState } from 'react';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import Loading from './Loading.jsx';
import Error from './Error.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { authenticatedFetch } from '../utils/api.js';
import { formatDate } from '../utils/dateUtils.js';
import './UserDetailModal.css';

/**
 * User Detail Modal
 * @param {number} userId - ID of the user to display
 * @param {boolean} isOpen - Whether the modal is currently open
 * @param {function} onClose - Callback to close the modal
 * @param {function} onUserUpdated - Callback when user is updated (refreshes parent list)
 */
function UserDetailModal({ userId, isOpen, onClose, onUserUpdated }) {
    const { user: currentUser } = useContext(UserContext);
    const { t } = useLanguage();
    const isManager = currentUser?.role === 'manager' || currentUser?.role === 'superuser';

    // State for the user data being displayed
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // State for editing user
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        suspicious: false,
        role: ''
    });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    
    // State for verification confirmation modal
    const [verifyModalOpen, setVerifyModalOpen] = useState(false);
    const [verifying, setVerifying] = useState(false);

    // Refresh key to force re-fetch when user is updated
    const [refreshKey, setRefreshKey] = useState(0);

    // Fetch user data when modal opens
    useEffect(() => {
        if (!isOpen || !userId) {
            return;
        }

        const controller = new AbortController();

        const fetchUser = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await authenticatedFetch(`/users/${userId}`, {
                    signal: controller.signal
                });

                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.dispatchEvent(new CustomEvent('tokenChange', { detail: { action: 'logout' } }));
                    throw new Error('Session expired. Please log in again.');
                }

                const contentType = response.headers.get('content-type');
                let payload;
                if (contentType && contentType.includes('application/json')) {
                    payload = await response.json();
                } else {
                    const text = await response.text();
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }

                if (!response.ok) {
                    throw new Error(payload.message || payload.Message || 'Unable to load user');
                }
                setUser(payload);
            } catch (err) {
                if (err.name === 'AbortError') {
                    return;
                }
                setError(err.message || 'Unable to load user');
            } finally {
                setLoading(false);
            }
        };

        if (isManager) {
            fetchUser();
        }

        return () => controller.abort();
    }, [userId, refreshKey, isOpen, isManager]);

    // Initialize edit form when entering edit mode
    useEffect(() => {
        if (isEditing && user) {
            setEditForm({
                suspicious: user.suspicious || false,
                role: user.role || 'regular'
            });
        }
    }, [isEditing, user]);

    // Refresh user data
    const refresh = () => {
        setRefreshKey((key) => key + 1);
        if (onUserUpdated) {
            onUserUpdated();
        }
    };

    // Handle updating user
    const handleUpdateUser = async (e) => {
        e.preventDefault();
        if (!user) return;

        setSaving(true);
        setSaveError('');

        try {
            const updates = {};
            // Always include suspicious if it changed (handles both true and false)
            if (editForm.suspicious !== (user.suspicious || false)) {
                updates.suspicious = editForm.suspicious;
            }
            if (editForm.role && editForm.role !== user.role) {
                updates.role = editForm.role;
            }

            if (Object.keys(updates).length === 0) {
                setSaveError('No changes to save');
                setSaving(false);
                return;
            }

            const response = await authenticatedFetch(`/users/${user.id}`, {
                method: 'PATCH',
                body: JSON.stringify(updates)
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                window.dispatchEvent(new CustomEvent('tokenChange', { detail: { action: 'logout' } }));
                throw new Error('Session expired. Please log in again.');
            }

            const contentType = response.headers.get('content-type');
            let payload;
            if (contentType && contentType.includes('application/json')) {
                payload = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            if (!response.ok) {
                throw new Error(payload.message || payload.Message || 'Unable to update user');
            }

            setIsEditing(false);
            refresh();
        } catch (err) {
            setSaveError(err.message || 'Unable to update user');
        } finally {
            setSaving(false);
        }
    };

    // Handle closing modal
    const handleClose = () => {
        setIsEditing(false);
        setEditForm({ suspicious: false, role: '' });
        setSaveError('');
        onClose();
    };
    
    // Handle verifying user (one-time action)
    const handleVerifyUser = async () => {
        if (!user) return;
        
        setVerifying(true);
        setVerifyModalOpen(false);
        
        try {
            const response = await authenticatedFetch(`/users/${user.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ verified: true })
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                window.dispatchEvent(new CustomEvent('tokenChange', { detail: { action: 'logout' } }));
                throw new Error('Session expired. Please log in again.');
            }

            const contentType = response.headers.get('content-type');
            let payload;
            if (contentType && contentType.includes('application/json')) {
                payload = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            if (!response.ok) {
                throw new Error(payload.message || payload.Message || 'Unable to verify user');
            }

            refresh();
        } catch (err) {
            setSaveError(err.message || 'Unable to verify user');
        } finally {
            setVerifying(false);
        }
    };

    if (!isOpen) {
        return null;
    }

    const roleColors = {
        regular: '#4CAF50',
        cashier: '#2196F3',
        manager: '#FF9800',
        superuser: '#9C27B0'
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="user-detail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>User Details</h2>
                    <button className="modal-close" onClick={handleClose}>×</button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <Loading message="Loading user..." />
                    ) : error ? (
                        <Error error={error} />
                    ) : user ? (
                        <>
                            {!isEditing ? (
                                // View mode
                                <div className="user-detail-view">
                                    <div className="user-detail-header">
                                        <div className="user-detail-info">
                                            <h3>{user.name || user.utorid}</h3>
                                            <p className="user-detail-utorid">{user.utorid}</p>
                                            {user.email && <p className="user-detail-email">{user.email}</p>}
                                        </div>
                                        <div className="user-detail-badges">
                                            <span
                                                className="role-badge-large"
                                                style={{ backgroundColor: roleColors[user.role] || '#666' }}
                                            >
                                                {user.role}
                                            </span>
                                            {user.verified ? (
                                                <span className="status-badge status-badge--verified">Verified</span>
                                            ) : (
                                                <span className="status-badge status-badge--unverified">Unverified</span>
                                            )}
                                            {user.suspicious && (
                                                <span className="status-badge status-badge--suspicious">Suspicious</span>
                                            )}
                                            {!user.activated && (
                                                <span className="status-badge status-badge--inactive">Inactive</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="user-detail-section">
                                        <h4>Account Information</h4>
                                        <div className="user-detail-grid">
                                            <div className="detail-item">
                                                <span className="detail-label">Points:</span>
                                                <span className="detail-value">{user.points?.toLocaleString() || 0}</span>
                                            </div>
                                            {user.birthday && (
                                                <div className="detail-item">
                                                    <span className="detail-label">Birthday:</span>
                                                    <span className="detail-value">{user.birthday}</span>
                                                </div>
                                            )}
                                            {user.createdAt && (
                                                <div className="detail-item">
                                                    <span className="detail-label">Joined:</span>
                                                    <span className="detail-value">{formatDate(user.createdAt)}</span>
                                                </div>
                                            )}
                                            {user.lastLogin && (
                                                <div className="detail-item">
                                                    <span className="detail-label">Last Login:</span>
                                                    <span className="detail-value">{formatDate(user.lastLogin)}</span>
                                                </div>
                                            )}
                                            <div className="detail-item">
                                                <span className="detail-label">Verified:</span>
                                                <span className="detail-value">{user.verified ? 'Yes' : 'No'}</span>
                                            </div>
                                            <div className="detail-item">
                                                <span className="detail-label">Suspicious:</span>
                                                <span className="detail-value">{user.suspicious ? 'Yes' : 'No'}</span>
                                            </div>
                                            {user.activated !== undefined && (
                                                <div className="detail-item">
                                                    <span className="detail-label">Activated:</span>
                                                    <span className="detail-value">{user.activated ? 'Yes' : 'No'}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {user.promotions && user.promotions.length > 0 && (
                                        <div className="user-detail-section">
                                            <h4>Promotions ({user.promotions.length})</h4>
                                            <div className="promotions-list">
                                                {user.promotions.slice(0, 5).map((promo) => (
                                                    <span key={promo.id} className="promo-tag">
                                                        {promo.name}
                                                    </span>
                                                ))}
                                                {user.promotions.length > 5 && (
                                                    <span className="promo-tag">+{user.promotions.length - 5} more</span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="modal-actions">
                                        <button className="secondary-btn" onClick={handleClose}>
                                            Close
                                        </button>
                                        {isManager && !user.verified && (
                                            <button 
                                                className="primary-btn" 
                                                onClick={() => setVerifyModalOpen(true)}
                                                disabled={verifying}
                                            >
                                                {verifying ? 'Verifying...' : 'Verify User'}
                                            </button>
                                        )}
                                        {isManager && (
                                            <button className="primary-btn" onClick={() => setIsEditing(true)}>
                                                Edit User
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                // Edit mode
                                <form onSubmit={handleUpdateUser} className="user-detail-edit">
                                    <div className="user-detail-header">
                                        <div className="user-detail-info">
                                            <h3>{user.name || user.utorid}</h3>
                                            <p className="user-detail-utorid">{user.utorid}</p>
                                        </div>
                                    </div>

                                    {saveError && <Error error={saveError} />}

                                    <div className="edit-form-fields">
                                        <label className="checkbox-label">
                                            Mark as Suspicious
                                            <input
                                                type="checkbox"
                                                checked={editForm.suspicious || false}
                                                onChange={(e) =>
                                                    setEditForm((prev) => ({
                                                        ...prev,
                                                        suspicious: e.target.checked
                                                    }))
                                                }
                                            />
                                        </label>
                                        <div className="role-field">
                                            <label className="role-label">
                                                Role
                                            </label>
                                            <select
                                                value={editForm.role}
                                                onChange={(e) =>
                                                    setEditForm((prev) => ({
                                                        ...prev,
                                                        role: e.target.value
                                                    }))
                                                }
                                            >
                                                <option value="regular">Regular</option>
                                                <option value="cashier">Cashier</option>
                                                {currentUser?.role === 'superuser' && (
                                                    <>
                                                        <option value="manager">Manager</option>
                                                        <option value="superuser">Superuser</option>
                                                    </>
                                                )}
                                                {currentUser?.role === 'manager' && (
                                                    <option value="manager">Manager</option>
                                                )}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="modal-actions">
                                        <button
                                            type="button"
                                            className="secondary-btn"
                                            onClick={() => {
                                                setIsEditing(false);
                                                setSaveError('');
                                            }}
                                            disabled={saving}
                                        >
                                            Cancel
                                        </button>
                                        <button type="submit" className="primary-btn" disabled={saving}>
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    ) : null}
                </div>
            </div>
            
            {/* Verification Confirmation Modal */}
            <ConfirmModal
                isOpen={verifyModalOpen}
                title="Verify User?"
                message={`Are you sure you want to verify ${user?.name || user?.utorid}? This action cannot be undone.`}
                confirmText="Verify User"
                cancelText="Cancel"
                onConfirm={handleVerifyUser}
                onCancel={() => setVerifyModalOpen(false)}
            />
        </div>
    );
}

export default UserDetailModal;

