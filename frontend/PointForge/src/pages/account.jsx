import { useState, useContext, useEffect } from 'react';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useColorblindMode } from '../contexts/ColorblindModeContext.jsx';
import { useInterfaceView } from '../contexts/InterfaceViewContext.jsx';
import { authenticatedFetch } from '../utils/api.js';
import { Error, SuccessModal } from '../components';
import './account.css';

function Account() {
    const { user, refreshUserData } = useContext(UserContext);
    const { language, setLanguage, t } = useLanguage();
    const { colorblindMode, setColorblindMode } = useColorblindMode();
    const { interfaceView, setInterfaceView, availableViews, effectiveRole } = useInterfaceView();
    const [activeSection, setActiveSection] = useState('profile');

    // Account info update state
    const [accountInfo, setAccountInfo] = useState({
        name: user?.name || '',
        email: user?.email || '',
        birthday: user?.birthday || ''
    });
    const [accountInfoError, setAccountInfoError] = useState('');
    const [accountInfoLoading, setAccountInfoLoading] = useState(false);
    const [accountInfoSuccess, setAccountInfoSuccess] = useState(false);

    // Password update state
    const [passwordForm, setPasswordForm] = useState({
        old: '',
        new: '',
        confirm: ''
    });
    const [passwordError, setPasswordError] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    const menuSections = [
        { id: 'profile', label: t('account.profile') },
        { id: 'accountInfo', label: t('account.accountInfo') },
        { id: 'password', label: t('account.updatePassword') },
        { id: 'resetPassword', label: t('account.resetPassword') },
        { id: 'interface', label: t('account.interface') },
        { id: 'accessibility', label: t('account.accessibility') },
    ];

    const languages = [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Español' },
        { code: 'fr', name: 'Français' },
        { code: 'zh', name: '中文' },
        { code: 'de', name: 'Deutsch' },
        { code: 'it', name: 'Italiano' },
        { code: 'pt', name: 'Português' },
        { code: 'ru', name: 'Русский' },
        { code: 'ja', name: '日本語' },
        { code: 'ko', name: '한국어' },
        { code: 'ar', name: 'العربية' },
        { code: 'hi', name: 'हिन्दी' },
        { code: 'nl', name: 'Nederlands' },
        { code: 'pl', name: 'Polski' },
        { code: 'tr', name: 'Türkçe' },
        { code: 'sv', name: 'Svenska' },
        { code: 'no', name: 'Norsk' },
        { code: 'da', name: 'Dansk' },
        { code: 'fi', name: 'Suomi' },
        { code: 'el', name: 'Ελληνικά' },
        { code: 'cs', name: 'Čeština' },
        { code: 'ro', name: 'Română' },
        { code: 'vi', name: 'Tiếng Việt' },
        { code: 'th', name: 'ไทย' },
    ];

    const colorblindModes = [
        { code: 'none', label: t('account.none') },
        { code: 'protanopia', label: t('account.protanopia') },
        { code: 'deuteranopia', label: t('account.deuteranopia') },
        { code: 'tritanopia', label: t('account.tritanopia') },
        { code: 'achromatopsia', label: t('account.achromatopsia') },
    ];

    // Update account info form when user changes
    useEffect(() => {
        if (user) {
            setAccountInfo({
                name: user.name || '',
                email: user.email || '',
                birthday: user.birthday || ''
            });
        }
    }, [user]);

    const handleAccountInfoSubmit = async (e) => {
        e.preventDefault();
        setAccountInfoError('');
        setAccountInfoLoading(true);
        setAccountInfoSuccess(false);

        try {
            const payload = {};
            if (accountInfo.name !== user?.name) payload.name = accountInfo.name;
            if (accountInfo.email !== user?.email) payload.email = accountInfo.email;
            if (accountInfo.birthday !== user?.birthday) payload.birthday = accountInfo.birthday;

            if (Object.keys(payload).length === 0) {
                setAccountInfoError('No changes to save');
                return;
            }

            const response = await authenticatedFetch('/users/me', {
                method: 'PATCH',
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.Message || data.message || 'Failed to update account information');
            }

            setAccountInfoSuccess(true);
            await refreshUserData();
            setTimeout(() => setAccountInfoSuccess(false), 3000);
        } catch (err) {
            setAccountInfoError(err.message || 'Failed to update account information');
        } finally {
            setAccountInfoLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setPasswordError('');

        if (passwordForm.new !== passwordForm.confirm) {
            setPasswordError('New passwords do not match');
            return;
        }

        if (passwordForm.new.length < 8) {
            setPasswordError('Password must be at least 8 characters long');
            return;
        }

        setPasswordLoading(true);
        setPasswordSuccess(false);

        try {
            const response = await authenticatedFetch('/users/me/password', {
                method: 'PATCH',
                body: JSON.stringify({
                    old: passwordForm.old,
                    new: passwordForm.new
                })
            });

            if (!response.ok) {
                const data = await response.json();
                setPasswordError(data.message || data.Message);
                console.log(data.message || data.Message);
                throw new Error(data.Message || data.message || 'Failed to update password');
            }

            setPasswordSuccess(true);
            setPasswordForm({ old: '', new: '', confirm: '' });
            setTimeout(() => setPasswordSuccess(false), 3000);
        } catch (err) {
            console.log(err);
        } finally {
            setPasswordLoading(false);
        }
    };

    const getInterfaceLabel = (view) => {
        const labels = {
            regular: 'Regular User',
            cashier: 'Cashier',
            manager: 'Manager',
            organizer: 'Event Organizer'
        };
        return labels[view] || view;
    };

    return (
        <div className="account-page">
            <div className="account-sidebar">
                <h2 className="account-sidebar-title">{t('account.title')}</h2>
                <nav className="account-sidebar-nav">
                    {menuSections.map((section) => (
                        <button
                            key={section.id}
                            className={`account-sidebar-item ${activeSection === section.id ? 'active' : ''}`}
                            onClick={() => setActiveSection(section.id)}
                        >
                            {section.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="account-content">
                {activeSection === 'profile' && (
                    <div className="account-section">
                        <h3 className="account-section-title">{t('account.profile')}</h3>
                        <div className="account-profile-info">
                            <div className="account-profile-field">
                                <label>{t('account.name')}</label>
                                <p>{user?.name || 'N/A'}</p>
                            </div>
                            <div className="account-profile-field">
                                <label>{t('account.email')}</label>
                                <p>{user?.email || 'N/A'}</p>
                            </div>
                            <div className="account-profile-field">
                                <label>UTORid</label>
                                <p>{user?.utorid || 'N/A'}</p>
                            </div>
                            <div className="account-profile-field">
                                <label>Role</label>
                                <p>{user?.role || 'N/A'}</p>
                            </div>
                            <div className="account-profile-field">
                                <label>Points</label>
                                <p>{user?.points?.toLocaleString() || 0}</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'accountInfo' && (
                    <div className="account-section">
                        <h3 className="account-section-title">{t('account.updateInfo')}</h3>
                        {accountInfoError && <Error error={accountInfoError} />}
                        {accountInfoSuccess && (
                            <div className="account-success-message">
                                Account information updated successfully!
                            </div>
                        )}
                        <form onSubmit={handleAccountInfoSubmit} className="account-form">
                            <div className="account-form-group">
                                <label htmlFor="name">
                                    {t('account.name')}
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    value={accountInfo.name}
                                    onChange={(e) => setAccountInfo({ ...accountInfo, name: e.target.value })}
                                    maxLength={50}
                                    disabled={accountInfoLoading}
                                />
                            </div>
                            <div className="account-form-group">
                                <label htmlFor="email">
                                    {t('account.email')}
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    value={accountInfo.email}
                                    onChange={(e) => setAccountInfo({ ...accountInfo, email: e.target.value })}
                                    disabled={accountInfoLoading}
                                />
                            </div>
                            <div className="account-form-group">
                                <label htmlFor="birthday">
                                    Birthday (YYYY-MM-DD)
                                </label>
                                <input
                                    type="date"
                                    id="birthday"
                                    value={accountInfo.birthday || ''}
                                    onChange={(e) => setAccountInfo({ ...accountInfo, birthday: e.target.value })}
                                    disabled={accountInfoLoading}
                                />
                            </div>
                            <button
                                type="submit"
                                className="account-form-submit"
                                disabled={accountInfoLoading}
                            >
                                {accountInfoLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                )}

                {activeSection === 'password' && (
                    <div className="account-section">
                        <h3 className="account-section-title">{t('account.updatePassword')}</h3>
                        {passwordError && <Error error={passwordError} />}
                        {passwordSuccess && (
                            <div className="account-success-message">
                                Password updated successfully!
                            </div>
                        )}
                        <form onSubmit={handlePasswordSubmit} className="account-form">
                            <div className="account-form-group">
                                <label htmlFor="oldPassword">
                                    Current Password
                                </label>
                                <input
                                    type="password"
                                    id="oldPassword"
                                    value={passwordForm.old}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, old: e.target.value })}
                                    disabled={passwordLoading}
                                    required
                                />
                            </div>
                            <div className="account-form-group">
                                <label htmlFor="newPassword">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    id="newPassword"
                                    value={passwordForm.new}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                                    disabled={passwordLoading}
                                    required
                                    minLength={8}
                                />
                                <small>Must be at least 8 characters with uppercase, lowercase, number, and special character</small>
                            </div>
                            <div className="account-form-group">
                                <label htmlFor="confirmPassword">
                                    Confirm New Password
                                </label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    value={passwordForm.confirm}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                    disabled={passwordLoading}
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="account-form-submit"
                                disabled={passwordLoading}
                            >
                                {passwordLoading ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    </div>
                )}

                {activeSection === 'resetPassword' && (
                    <div className="account-section">
                        <h3 className="account-section-title">{t('account.resetPassword')}</h3>
                        <div className="account-form-skeleton">
                            <p className="account-skeleton-note">
                                To reset your password, please use the "Forgot Password" link on the login page.
                                This will send a password reset email to your registered email address.
                            </p>
                        </div>
                    </div>
                )}

                {activeSection === 'interface' && (
                    <div className="account-section">
                        <h3 className="account-section-title">{t('account.switchInterface')}</h3>
                        <div className="account-setting-group">
                            <label className="account-setting-label">
                                Current Interface View
                            </label>
                            <p className="account-interface-info">
                                You are currently viewing the interface as: <strong>{getInterfaceLabel(effectiveRole)}</strong>
                            </p>
                            {interfaceView && (
                                <p className="account-interface-note">
                                    (Switched from your actual role: {user?.role})
                                </p>
                            )}
                        </div>
                        <div className="account-setting-group">
                            <label className="account-setting-label">
                                Switch Interface View
                            </label>
                            <select
                                className="account-setting-select"
                                value={interfaceView || user?.role || 'regular'}
                                onChange={(e) => {
                                    const selectedView = e.target.value;
                                    // Save to localStorage synchronously before reload
                                    if (selectedView === user?.role) {
                                        localStorage.removeItem('interfaceView');
                                        setInterfaceView(null); // Reset to actual role
                                    } else {
                                        localStorage.setItem('interfaceView', selectedView);
                                        setInterfaceView(selectedView);
                                    }
                                    // Small delay to ensure localStorage is written, then reload
                                    setTimeout(() => {
                                        window.location.reload();
                                    }, 100);
                                }}
                            >
                                {availableViews.map((view) => (
                                    <option key={view} value={view}>
                                        {getInterfaceLabel(view)} {view === user?.role ? '(Default)' : ''}
                                    </option>
                                ))}
                            </select>
                            <small className="account-interface-help">
                                Switch between different interface views based on your roles and permissions.
                                This affects what features and pages you can see.
                            </small>
                        </div>
                    </div>
                )}

                {activeSection === 'accessibility' && (
                    <div className="account-section">
                        <h3 className="account-section-title">{t('account.accessibility')}</h3>
                        
                        <div className="account-setting-group">
                            <label className="account-setting-label">{t('account.language')}</label>
                            <select
                                className="account-setting-select"
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                            >
                                {languages.map((lang) => (
                                    <option key={lang.code} value={lang.code}>
                                        {lang.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="account-setting-group">
                            <label className="account-setting-label">{t('account.colorblindMode')}</label>
                            <select
                                className="account-setting-select"
                                value={colorblindMode}
                                onChange={(e) => setColorblindMode(e.target.value)}
                            >
                                {colorblindModes.map((mode) => (
                                    <option key={mode.code} value={mode.code}>
                                        {mode.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Account;
