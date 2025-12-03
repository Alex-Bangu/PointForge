import { useState } from 'react';
import {Link, useNavigate} from 'react-router-dom';
import { unauthenticatedFetch, setAuthToken } from '../utils/api.js';
import { Error } from '../components';
import { useLanguage } from '../contexts/LanguageContext.jsx';


function Login() {
   const { t, language, setLanguage } = useLanguage();
   const [utorid, setUtorid] = useState('');
   const [password, setPassword] = useState('');
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
         const response = await unauthenticatedFetch('/auth/tokens', {
           method: 'POST',
           body: JSON.stringify({ utorid, password }),
         });
        
         const data = await response.json();
        
         if (!response.ok) {
           setError(data.Error || t('error.loginFailed'));
           return;
         }
        
        // Store token in memory for cross-domain fallback (if cookies don't work)
        // Backend sets httpOnly cookie, but we also store token for Authorization header fallback
        if (data.token) {
            setAuthToken(data.token);
        }
        
        // Small delay to ensure cookie is set before making authenticated requests
        // This prevents race conditions where UserContext tries to fetch before cookie is available
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Dispatch custom event to notify UserContext to refresh
        window.dispatchEvent(new CustomEvent('tokenChange', { detail: { action: 'login' } }));
        
        navigate('/dashboard');

       } catch (err) {
         setError(t('error.network'));
       } finally {
         setLoading(false);
       }
     };


   return (
        <div className="login-wrapper">
            <form className="login-card" onSubmit={handleSubmit}>
                <h2 className="login-title">{t('login.title')}</h2>

                <Error error={error} />

                <div className="language-selector-wrapper">
                    <label htmlFor="language-select">{t('account.language')}</label>
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

                <button type="submit" className="login-btn" disabled={loading}>
                    {loading ? t('login.logging') : t('login.submit')}
                </button>
                <button 
                    type="button" 
                    className="register-btn" 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Register button clicked, navigating to /login/register');
                        navigate('/login/register');
                    }}
                >
                    {t('login.register')}
                </button>
                <div className="forgot-bar">
                    <Link 
                        to="/login/forgot" 
                        onClick={(e) => {
                            e.stopPropagation();
                            console.log('Forgot password link clicked, navigating to /login/forgot');
                        }}
                    >
                        {t('login.forgot')}
                    </Link>
                </div>
            </form>
        </div>
    );
}


export default Login;