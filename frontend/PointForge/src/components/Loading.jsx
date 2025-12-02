/**
 * Reusable loading component
 */
import { useLanguage } from '../contexts/LanguageContext.jsx';

function Loading({ message }) {
    const { t } = useLanguage();
    return (
        <div className="container">
            <div>{message || t('common.loading')}</div>
        </div>
    );
}

export default Loading;
