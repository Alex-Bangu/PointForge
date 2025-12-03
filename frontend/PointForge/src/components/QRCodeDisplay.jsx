// External library: qrcode.react
// Source: https://www.npmjs.com/package/qrcode.react
// Used for generating QR codes for transaction redemption
import { QRCodeSVG } from 'qrcode.react';
import './QRCodeDisplay.css';

/**
 * QR Code Display Component
 * Reusable component for displaying QR codes
 * @param {string} value - The value to encode in the QR code
 * @param {string} label - Optional label to display above the QR code
 * @param {number} size - Size of the QR code in pixels (default: 256)
 */
function QRCodeDisplay({ value, label, size = 256 }) {
    if (!value) {
        return <div className="qr-code-error">No QR code data</div>;
    }
    
    return (
        <div className="qr-code-container">
            {label && <p className="qr-code-label">{label}</p>}
            <div className="qr-code-wrapper">
                <QRCodeSVG 
                    value={String(value)} 
                    size={size}
                    level="M"
                    includeMargin={true}
                />
            </div>
        </div>
    );
}

export default QRCodeDisplay;

