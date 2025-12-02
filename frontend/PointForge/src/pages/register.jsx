import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { unauthenticatedFetch } from '../utils/api.js';
import { Error } from '../components';
import { useLanguage } from '../contexts/LanguageContext.jsx';


function Register() {
    const { t, language, setLanguage } = useLanguage();
    const [utorid, setUtorid] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if(password !== confirmPassword) {
                setError(t('error.passwordsMatch'));
                setPassword('');
                setConfirmPassword('');
                return;
            }

            const response = await unauthenticatedFetch('/users', {
                method: 'POST',
                body: JSON.stringify({ utorid, password, name, email }),
            });
            const data = await response.json();

            if (!response.ok) {
                console.log(data);
                setError(data.Message);
                return;
            }
            navigate('/login');

        } catch (err) {
            console.log(err);
            setError(t('error.network'));
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="login-wrapper">
            <form className="login-card" onSubmit={handleSubmit}>
                <div className="register-header">
                    <p className="back-btn" onClick={() => navigate("/login")}>&lt;-</p>
                    <h2 className="login-title">{t('register.title')}</h2>
                    <p className="spacer"></p>
                </div>

                <Error error={error} />

                <div className="language-selector-wrapper">
                    <label htmlFor="language-select">{t('register.language')}</label>
                    <select
                        id="language-select"
                        className="language-selector"
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

                <div className="input-group">
                    <label htmlFor="utorid">{t('login.utorid')}</label>
                    <input
                        id="utorid"
                        type="text"
                        value={utorid}
                        onChange={(e) => setUtorid(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>

                <div className="input-group">
                    <label htmlFor="name">{t('register.name')}</label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="email">{t('register.email')}</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="password">{t('login.password')}</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="confirmPassword">{t('register.confirmPassword')}</label>
                    <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>
                <button type="submit" className="register-btn" disabled={loading}>
                    {loading ? t('register.registering') : t('register.submit')}
                </button>
            </form>
        </div>
    );
}


export default Register;