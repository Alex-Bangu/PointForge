import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { unauthenticatedFetch } from '../utils/api.js';
import Error from '../components/Error.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';


function Reset() {
    const { t } = useLanguage();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const { resetId } = useParams();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        console.log(resetId);

        try {
            if(password !== confirmPassword) {
                setError(t('error.passwordsMatch'));
                return;
            }
            const response = await unauthenticatedFetch('/auth/resets/' + resetId, {
                method: 'POST',
                body: JSON.stringify({ password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data["message"]);
                return;
            }

            setSuccess(t('reset.success'));
        } catch (err) {
            setError(t('error.network'));
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="login-wrapper">
            <form className="login-card" onSubmit={handleSubmit}>
                <div className="register-header">
                    <h2 className="login-title">{t('reset.title')}</h2>
                    <p className="spacer"></p>
                </div>

                <Error error={error} />
                {success && <div className="success-message">{success}</div>}


                <div className="input-group">
                    <label htmlFor="newPassword">{t('reset.newPassword')}</label>
                    <input
                        id="newPassword"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="confirmNewPassword">{t('reset.confirmNewPassword')}</label>
                    <input
                        id="confirmNewPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>

                <button type="submit" className="login-btn" disabled={loading}>
                    {loading ? t('reset.resetting') : t('reset.submit')}
                </button>
            </form>
        </div>
    );
}


export default Reset;