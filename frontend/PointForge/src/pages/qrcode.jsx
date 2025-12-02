import { useContext } from 'react';
import { UserContext } from '../contexts/UserContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { QRCodeDisplay, Loading, Error } from '../components';
import './qrcode.css';

/**
 * QR Code Page
 * Displays the user's utorid as a QR code for cashiers to scan
 * to initiate purchase or transfer transactions
 */
function QRCode() {
    const { user, loading, error } = useContext(UserContext);
    const { t } = useLanguage();

    if (loading) {
        return <Loading message={t('common.loading')} />;
    }

    if (error) {
        return <Error error={error} />;
    }

    if (!user) {
        return <Error error={t('error.unableToLoad') + ' user'} />;
    }

    return (
        <div className="qrcode-page container">
            <div className="qrcode-header-section">
                <div className="qrcode-header">
                    <h1 className="qrcode-title">{t('qrcode.title')}</h1>
                    <p className="qrcode-subtitle">{t('qrcode.subtitle')}</p>
                </div>
            </div>

            <div className="qrcode-content">
                <QRCodeDisplay 
                    value={user.utorid} 
                    label={t('qrcode.yourUtorid')}
                    size={280}
                />
                
                <div className="qrcode-info">
                    <div className="qrcode-info-item">
                        <span className="qrcode-info-label">{t('qrcode.utorid')}</span>
                        <span className="qrcode-info-value">{user.utorid}</span>
                    </div>
                    <p className="qrcode-instructions">
                        {t('qrcode.instructions')}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default QRCode;

