import { useState, useContext } from 'react';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useColorblindMode } from '../contexts/ColorblindModeContext.jsx';
import './account.css';

function Account() {
    const { user } = useContext(UserContext);
    const { language, setLanguage, t } = useLanguage();
    const { colorblindMode, setColorblindMode } = useColorblindMode();
    const [activeSection, setActiveSection] = useState('profile');

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
                        </div>
                    </div>
                )}

                {activeSection === 'accountInfo' && (
                    <div className="account-section">
                        <h3 className="account-section-title">{t('account.updateInfo')}</h3>
                        <div className="account-form-skeleton">
                            <p className="account-skeleton-note">
                                {/* Placeholder for account information update form */}
                                This section will allow users to update their account information.
                            </p>
                        </div>
                    </div>
                )}

                {activeSection === 'password' && (
                    <div className="account-section">
                        <h3 className="account-section-title">{t('account.updatePassword')}</h3>
                        <div className="account-form-skeleton">
                            <p className="account-skeleton-note">
                                {/* Placeholder for password update form */}
                                This section will allow users to update their password.
                            </p>
                        </div>
                    </div>
                )}

                {activeSection === 'resetPassword' && (
                    <div className="account-section">
                        <h3 className="account-section-title">{t('account.resetPassword')}</h3>
                        <div className="account-form-skeleton">
                            <p className="account-skeleton-note">
                                {/* Placeholder for password reset form */}
                                This section will allow users to reset their password using the existing backend logic.
                            </p>
                        </div>
                    </div>
                )}

                {activeSection === 'interface' && (
                    <div className="account-section">
                        <h3 className="account-section-title">{t('account.switchInterface')}</h3>
                        <div className="account-form-skeleton">
                            <p className="account-skeleton-note">
                                {/* Placeholder for interface switching */}
                                This section will allow users to switch between different interfaces (cashier, event organizer, manager, regular user) based on their permissions.
                            </p>
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
