import './Transaction.css';
import { useLanguage } from '../contexts/LanguageContext.jsx';

function Transaction({transaction, onDetailClick}) {
    const { t, language } = useLanguage();
    if (!transaction) {
        return null;
    }

    let amountLabel = "";
    let pointsString = "";
    let utoridDisplay = "";
    let typeClass = `transaction-type-${transaction.type}`;
    
    // Translate transaction type
    const getTransactionTypeLabel = (type) => {
        switch (type) {
            case 'purchase':
                return t('transactionCard.typePurchase');
            case 'redemption':
                return t('transactionCard.typeRedemption');
            case 'transfer':
                return t('transactionCard.typeTransfer');
            case 'event':
                return t('transactionCard.typeEvent');
            case 'adjustment':
                return t('transactionCard.typeAdjustment');
            default:
                return type;
        }
    };

    switch (transaction.type) {
        case 'purchase':
            // Ensure spent is treated as a float to preserve decimals
            const spentValue = transaction.spent != null ? parseFloat(transaction.spent) : 0;
            amountLabel = "$" + spentValue.toFixed(2);
            pointsString = t('transactionCard.pointsPlus') + String(transaction.amount || 0) + " " + t('transactionCard.points');
            if (transaction.utorid) {
                utoridDisplay = `${t('transactionCard.to')} ${transaction.utorid}`;
            }
            break;
        case 'redemption':
            // For redemption, only show points (no amount label to avoid redundancy)
            pointsString = t('transactionCard.pointsMinus') + String(Math.abs(transaction.redeemed || transaction.amount || 0)) + " " + t('transactionCard.points');
            if (transaction.utorid) {
                utoridDisplay = `${t('transactionCard.from')} ${transaction.utorid}`;
            }
            break;
        case 'adjustment':
            const adjustmentAmount = transaction.amount || 0;
            pointsString = (adjustmentAmount >= 0 ? t('transactionCard.pointsPlus') : "") + String(adjustmentAmount) + " " + t('transactionCard.points');
            if (transaction.utorid) {
                utoridDisplay = `${t('transactionCard.to')} ${transaction.utorid}`;
            }
            break;
        case 'event':
            pointsString = t('transactionCard.pointsPlus') + String(transaction.awarded || transaction.amount || 0) + " " + t('transactionCard.points');
            if (transaction.recipient) {
                utoridDisplay = `${t('transactionCard.recipient')} ${transaction.recipient}`;
            } else if (transaction.utorid) {
                utoridDisplay = `${t('transactionCard.recipient')} ${transaction.utorid}`;
            }
            break;
        case 'transfer':
            // For transfers, API returns sender, recipient, and sent (positive amount)
            const transferAmount = transaction.sent || Math.abs(transaction.sent || 0);
            
            // Check if this is an outgoing (sent) or incoming (received) transfer
            const isIncoming = transaction.sent > 0;
            if (isIncoming && transaction.sender) {
                // Received transfer
                pointsString = t('transactionCard.pointsPlus') + String(transferAmount) + " " + t('transactionCard.points');
                utoridDisplay = `${t('transactionCard.from')} ${transaction.sender}`;
            } else if (transaction.recipient) {
                // Sent transfer
                pointsString = t('transactionCard.pointsMinus') + String(transferAmount) + " " + t('transactionCard.points');
                utoridDisplay = `${t('transactionCard.to')} ${transaction.recipient}`;
            } else {
                // Fallback
                pointsString = (transaction.amount >= 0 ? t('transactionCard.pointsPlus') : t('transactionCard.pointsMinus')) + String(transferAmount) + " " + t('transactionCard.points');
                if (transaction.sender) {
                    utoridDisplay = `${t('transactionCard.from')} ${transaction.sender}`;
                } else if (transaction.recipient) {
                    utoridDisplay = `${t('transactionCard.to')} ${transaction.recipient}`;
                }
            }
            break;
        default:
            break;
    }

    const handleClick = (e) => {
        if (onDetailClick && transaction.id) {
            e.preventDefault();
            onDetailClick(transaction.id);
        }
    };

    const cardContent = (
        <>
            <div className="transaction-left">
                <div className="transaction-header">
                    <span className={`transaction-type-badge transaction-type-badge--${transaction.type}`}>
                        {getTransactionTypeLabel(transaction.type)}
                    </span>
                    {transaction.suspicious && (
                        <span className="transaction-badge transaction-badge--suspicious">{t('transactionCard.suspicious')}</span>
                    )}
                </div>
                <div className="transaction-details-row">
                    {amountLabel && <span className="transaction-amount">{amountLabel}</span>}
                    {utoridDisplay && <span className="transaction-utorid">{utoridDisplay}</span>}
                </div>
                {transaction.date && (
                    <div className="transaction-date-row">
                        <span className="transaction-date">
                            {new Date(transaction.date).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : language === 'ko' ? 'ko-KR' : language === 'ar' ? 'ar-SA' : language === 'hi' ? 'hi-IN' : language === 'th' ? 'th-TH' : language === 'vi' ? 'vi-VN' : language || 'en-US')}
                        </span>
                    </div>
                )}
            </div>
            <div className="transaction-right">
                <p className="transaction-points">{pointsString}</p>
            </div>
        </>
    );

    return (
        <li className={`transaction-card ${typeClass}`}>
            {onDetailClick ? (
                <button className="transaction-card-link transaction-card-button" onClick={handleClick}>
                    {cardContent}
                </button>
            ) : (
                cardContent
            )}
        </li>
    )
}

export default Transaction;