import './Transaction.css';

function Transaction({transaction, onDetailClick}) {
    if (!transaction) {
        return null;
    }

    let amountLabel = "";
    let pointsString = "";
    let utoridDisplay = "";
    let typeClass = `transaction-type-${transaction.type}`;

    switch (transaction.type) {
        case 'purchase':
            // Ensure spent is treated as a float to preserve decimals
            const spentValue = transaction.spent != null ? parseFloat(transaction.spent) : 0;
            amountLabel = "$" + spentValue.toFixed(2);
            pointsString = "+" + String(transaction.amount || 0) + " pts";
            if (transaction.utorid) {
                utoridDisplay = `To: ${transaction.utorid}`;
            }
            break;
        case 'redemption':
            // For redemption, only show points (no amount label to avoid redundancy)
            pointsString = "-" + String(Math.abs(transaction.redeemed || transaction.amount || 0)) + " pts";
            if (transaction.utorid) {
                utoridDisplay = `From: ${transaction.utorid}`;
            }
            break;
        case 'adjustment':
            const adjustmentAmount = transaction.amount || 0;
            pointsString = (adjustmentAmount >= 0 ? "+" : "") + String(adjustmentAmount) + " pts";
            if (transaction.utorid) {
                utoridDisplay = `To: ${transaction.utorid}`;
            }
            break;
        case 'event':
            pointsString = "+" + String(transaction.awarded || transaction.amount || 0) + " pts";
            if (transaction.recipient) {
                utoridDisplay = `Recipient: ${transaction.recipient}`;
            } else if (transaction.utorid) {
                utoridDisplay = `Recipient: ${transaction.utorid}`;
            }
            break;
        case 'transfer':
            // For transfers, API returns sender, recipient, and sent (positive amount)
            const transferAmount = transaction.sent || Math.abs(transaction.amount || 0);
            
            // Check if this is an outgoing (sent) or incoming (received) transfer
            const isIncoming = transaction.amount > 0;
            if (isIncoming && transaction.sender) {
                // Received transfer
                pointsString = "+" + String(transferAmount) + " pts";
                utoridDisplay = `From: ${transaction.sender}`;
            } else if (transaction.recipient) {
                // Sent transfer
                pointsString = "-" + String(transferAmount) + " pts";
                utoridDisplay = `To: ${transaction.recipient}`;
            } else {
                // Fallback
                pointsString = (transaction.amount >= 0 ? "+" : "-") + String(transferAmount) + " pts";
                if (transaction.sender) {
                    utoridDisplay = `From: ${transaction.sender}`;
                } else if (transaction.recipient) {
                    utoridDisplay = `To: ${transaction.recipient}`;
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
                        {transaction.type}
                    </span>
                    {transaction.suspicious && (
                        <span className="transaction-badge transaction-badge--suspicious">Suspicious</span>
                    )}
                </div>
                <div className="transaction-details-row">
                    {amountLabel && <span className="transaction-amount">{amountLabel}</span>}
                    {utoridDisplay && <span className="transaction-utorid">{utoridDisplay}</span>}
                </div>
                {transaction.date && (
                    <div className="transaction-date-row">
                        <span className="transaction-date">
                            {new Date(transaction.date).toLocaleString()}
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