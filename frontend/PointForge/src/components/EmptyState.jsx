/**
 * Reusable empty state component
 */
import { useLanguage } from '../contexts/LanguageContext.jsx';

function EmptyState({ message }) {
    const { t } = useLanguage();
    return <li className="empty-state">{message || t('common.noItemsFound')}</li>;
}

export default EmptyState;
