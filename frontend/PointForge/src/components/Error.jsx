/**
 * Reusable error display component
 */
function Error({ error, className = "", container = false }) {
    if (!error) return null;
    
    const errorElement = (
        <div className={`error-message ${className}`}>
            {error}
        </div>
    );
    
    if (container) {
        return (
            <div className="container">
                {errorElement}
            </div>
        );
    }
    
    return errorElement;
}

export default Error;
