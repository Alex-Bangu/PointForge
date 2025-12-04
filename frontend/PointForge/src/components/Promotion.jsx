import './Promotion.css';
import { useLanguage } from '../contexts/LanguageContext.jsx';

/**
 * Promotion Card Component. This is the Promotion Card that we see in the Promotion Wallet in the dashboard
 * @param {object} promotion - The promotion data to display
 * @param {function} onDetailClick - Callback when card is clicked (opens popup modal)
 */
function Promotion({promotion, onDetailClick}) {
    const { t } = useLanguage();

    if (!promotion) {
        return null;
    }

    const rewardParts = [];

    if (promotion.rate) {
        rewardParts.push(`${Math.round(promotion.rate * 100)}% ${t('promotionCard.bonus')}`);
    }

    if (promotion.points) {
        rewardParts.push(`${promotion.points} ${t('promotionCard.points')}`);
    }

    const amount = rewardParts.length > 0 ? rewardParts.join(' · ') : t('promotionCard.none');
    
    // Format the type display (convert database values to readable text)
    const typeDisplay = promotion.type === 'automatic' ? t('promotionCard.automatic') : promotion.type === 'onetime' ? t('promotionCard.oneTime') : promotion.type;

    // Handle click - opens popup modal via callback from parent
    const handleClick = (e) => {
        if(onDetailClick && promotion.id) {
            e.preventDefault();        // Stop default button behavior
            onDetailClick(promotion.id); // Call the function passed from parent (opens popup)
        }
    };

    return (
        <li className="promotion-card">
            <button onClick={handleClick} className="promotion-card-link promotion-card-button">
                <div className="promotion-left">
                    <h3 className="promotion-title">{promotion.name}</h3>
                    <p className="promotion-type">{typeDisplay}</p>
                </div>
                <div className="promotion-right">
                    <p className="promotion-amount">{amount}</p>
                </div>
            </button>
        </li>
    )
}

export default Promotion;