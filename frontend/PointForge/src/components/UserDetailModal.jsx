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

                // authenticatedFetch handles 401 automatically
                if (response.status === 401) {
                    throw new Error(t('error.sessionExpired'));
                }

                const contentType = response.headers.get('content-type');
                let payload;
                if (contentType && contentType.includes('application/json')) {
                    payload = await response.json();
                } else {
                    throw new Error(`${t('error.serverError')}: ${response.status} ${response.statusText}`);
                }

                if (!response.ok) {
                    throw new Error(payload.message || payload.Message || t('error.unableToLoadUser'));
                }
                setUser(payload);
            } catch (err) {
                if (err.name === 'AbortError') {
                    return;
                }
                setError(err.message || t('error.unableToLoadUser'));
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
                setSaveError(t('error.noChangesToSave'));
                setSaving(false);
                return;
            }

            const response = await authenticatedFetch(`/users/${user.id}`, {
                method: 'PATCH',
                body: JSON.stringify(updates)
            });

            // authenticatedFetch handles 401 automatically
            if (response.status === 401) {
                throw new Error(t('error.sessionExpired'));
            }

            const contentType = response.headers.get('content-type');
            let payload;
            if (contentType && contentType.includes('application/json')) {
                payload = await response.json();
            } else {
                throw new Error(`${t('error.serverError')}: ${response.status} ${response.statusText}`);
            }

            if (!response.ok) {
                const errorMessage = payload.message || payload.Message || t('error.unableToUpdateUser');
                setSaveError(errorMessage); // Set the error state
                throw new Error(errorMessage); // Then throw the error
            }

            setIsEditing(false);
            refresh();
        } catch {
            // Do nothing here like lmao there's nothing to do here
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

            // authenticatedFetch handles 401 automatically
            if (response.status === 401) {
                throw new Error('Session expired. Please log in again.');
            }

            const contentType = response.headers.get('content-type');
            let payload;
            if (contentType && contentType.includes('application/json')) {
                payload = await response.json();
            } else {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            if (!response.ok) {
                const errorMessage = payload.message || payload.Message || t('error.unableToVerifyUser');
                setSaveError(errorMessage); // Set the error state
                throw new Error(errorMessage); // Then throw the error
            }

            refresh();
        } catch {
            // Do nothing man there's nothing to do here
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
    
    // Translate role
    const getRoleLabel = (role) => {
        switch (role) {
            case 'regular':
                return t('users.roleRegular');
            case 'cashier':
                return t('users.roleCashier');
            case 'manager':
                return t('users.roleManager');
            case 'superuser':
                return t('users.roleSuperuser');
            default:
                return role;
        }
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="user-detail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{t('userDetail.title')}</h2>
                    <button className="modal-close" onClick={handleClose}>×</button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <Loading message={t('userDetail.loading')} />
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
                                                {getRoleLabel(user.role)}
                                            </span>
                                            {user.verified ? (
                                                <span className="status-badge status-badge--verified">{t('users.verified')}</span>
                                            ) : (
                                                <span className="status-badge status-badge--unverified">{t('users.notVerified')}</span>
                                            )}
                                            {user.suspicious && (
                                                <span className="status-badge status-badge--suspicious">{t('transactionCard.suspicious')}</span>
                                            )}
                                            {!user.activated && (
                                                <span className="status-badge status-badge--inactive">{t('userDetail.inactive')}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="user-detail-section">
                                        <h4>{t('userDetail.accountInformation')}</h4>
                                        <div className="user-detail-grid">
                                            <div className="detail-item">
                                                <span className="detail-label">{t('userDetail.points')}</span>
                                                <span className="detail-value">{user.points?.toLocaleString() || 0}</span>
                                            </div>
                                            {user.birthday && (
                                                <div className="detail-item">
                                                    <span className="detail-label">{t('userDetail.birthday')}</span>
                                                    <span className="detail-value">{user.birthday}</span>
                                                </div>
                                            )}
                                            {user.createdAt && (
                                                <div className="detail-item">
                                                    <span className="detail-label">{t('userDetail.joined')}</span>
                                                    <span className="detail-value">{formatDate(user.createdAt)}</span>
                                                </div>
                                            )}
                                            {user.lastLogin && (
                                                <div className="detail-item">
                                                    <span className="detail-label">{t('userDetail.lastLogin')}</span>
                                                    <span className="detail-value">{formatDate(user.lastLogin)}</span>
                                                </div>
                                            )}
                                            <div className="detail-item">
                                                <span className="detail-label">{t('userDetail.verified')}</span>
                                                <span className="detail-value">{user.verified ? t('userDetail.yes') : t('userDetail.no')}</span>
                                            </div>
                                            <div className="detail-item">
                                                <span className="detail-label">{t('userDetail.suspicious')}</span>
                                                <span className="detail-value">{user.suspicious ? t('userDetail.yes') : t('userDetail.no')}</span>
                                            </div>
                                            {user.activated !== undefined && (
                                                <div className="detail-item">
                                                    <span className="detail-label">{t('userDetail.activated')}</span>
                                                    <span className="detail-value">{user.activated ? t('userDetail.yes') : t('userDetail.no')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {user.promotions && user.promotions.length > 0 && (
                                        <div className="user-detail-section">
                                            <h4>{t('userDetail.promotions')} ({user.promotions.length})</h4>
                                            <div className="promotions-list">
                                                {user.promotions.slice(0, 5).map((promo) => (
                                                    <span key={promo.id} className="promo-tag">
                                                        {promo.name}
                                                    </span>
                                                ))}
                                                {user.promotions.length > 5 && (
                                                    <span className="promo-tag">+{user.promotions.length - 5} {t('userDetail.more')}</span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="modal-actions">
                                        <button className="secondary-btn" onClick={handleClose}>
                                            {t('userDetail.close')}
                                        </button>
                                        {isManager && !user.verified && (
                                            <button 
                                                className="primary-btn" 
                                                onClick={() => setVerifyModalOpen(true)}
                                                disabled={verifying}
                                            >
                                                {verifying ? t('userDetail.verifying') : t('userDetail.verifyUser')}
                                            </button>
                                        )}
                                        {isManager && (
                                            <button className="primary-btn" onClick={() => setIsEditing(true)}>
                                                {t('userDetail.editUser')}
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
                                            {t('userDetail.markAsSuspicious')}
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
                                                {t('userDetail.role')}
                                            </label>
                                            {user.suspicious ? (
                                                <p className="role-message">
                                                    {t('userDetail.cannotPromoteSuspicious')}
                                                </p>
                                            ) : currentUser.role === 'manager' && (user.role === 'manager' || user.role === 'superuser') ? (
                                                <p className="role-message">
                                                    {t('userDetail.cannotChangeHigherRole')}
                                                </p>
                                            ) : (
                                                <select
                                                    value={editForm.role}
                                                    onChange={(e) =>
                                                        setEditForm((prev) => ({
                                                            ...prev,
                                                            role: e.target.value
                                                        }))
                                                    }
                                                >
                                                    {/* Superusers can assign any role */}
                                                    {currentUser?.role === 'superuser' && (
                                                        <>
                                                            <option value="regular">{t('users.roleRegular')}</option>
                                                            <option value="cashier">{t('users.roleCashier')}</option>
                                                            <option value="manager">{t('users.roleManager')}</option>
                                                            <option value="superuser">{t('users.roleSuperuser')}</option>
                                                        </>
                                                    )}
                                                    {/* Managers can only assign regular or cashier roles */}
                                                    {currentUser?.role === 'manager' && (
                                                        <>
                                                            <option value="regular">{t('users.roleRegular')}</option>
                                                            <option value="cashier">{t('users.roleCashier')}</option>
                                                        </>
                                                    )}
                                                </select>
                                            )}
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
                                            {t('userDetail.cancel')}
                                        </button>
                                        <button type="submit" className="primary-btn" disabled={saving}>
                                            {saving ? t('userDetail.saving') : t('userDetail.saveChanges')}
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
                title={t('userDetail.verifyUserTitle')}
                message={t('userDetail.verifyUserMessage').replace('{name}', user?.name || user?.utorid)}
                confirmText={t('userDetail.verifyUser')}
                cancelText={t('userDetail.cancel')}
                onConfirm={handleVerifyUser}
                onCancel={() => setVerifyModalOpen(false)}
            />
        </div>
    );
}

export default UserDetailModal;

