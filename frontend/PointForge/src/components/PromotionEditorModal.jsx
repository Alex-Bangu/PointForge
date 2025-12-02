import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import './PromotionEditorModal.css';
import { percentFromDecimal } from '../utils/promotionUtils.js';

const DEFAULT_FORM = {
    name: '',
    description: '',
    type: 'automatic',
    startTime: '',
    endTime: '',
    minSpending: '',
    rate: '',
    points: ''
};

// Convert a date (from server in UTC/ISO format) to local datetime-local format
const toInputValue = (value) => {
    if(!value) {
        return '';
    }
    const date = new Date(value);
    if(Number.isNaN(date.getTime())) {
        return '';
    }
    // Convert UTC date to local time for datetime-local input
    // datetime-local inputs expect local time, not UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const normalizeTypeForForm = (type) => {
    if(type === 'onetime' || type === 'one-time') {
        return 'onetime';
    }
    return type || 'automatic';
};

function PromotionEditorModal({ isOpen, mode = 'create', initialValues = {}, onClose, onSubmit, busy = false, error = '' }) {
    const { t } = useLanguage();
    const [formValues, setFormValues] = useState(DEFAULT_FORM);
    const [payloadValues, setPayloadValues] = useState({});

    // Convert a Date object to local datetime-local format (local timezone, not UTC)
    const toLocalDateTimeString = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    // Parse a datetime-local string (local time) into a Date object
    const parseLocalDateTime = (value) => {
        if(!value) return null;
        const [datePart, timePart] = value.split('T');
        if(!datePart || !timePart) return null;
        
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        
        // Create Date object explicitly in local timezone
        return new Date(year, month - 1, day, hours, minutes, 0, 0);
    };

    // Calculate minimum datetime for startTime (allow 5 minutes in the past for buffer)
    const getMinStartTime = () => {
        const now = new Date(); // Local time
        now.setMinutes(now.getMinutes() - 5); // Allow 5 minutes in the past (matches backend buffer)
        return toLocalDateTimeString(now);
    };

    // Calculate minimum datetime for endTime (should be after startTime)
    const getMinEndTime = () => {
        if(formValues.startTime) {
            // Parse the datetime-local value as local time
            const startDate = parseLocalDateTime(formValues.startTime);
            if(startDate && !Number.isNaN(startDate.getTime())) {
                // End time should be at least 1 minute after start time
                startDate.setMinutes(startDate.getMinutes() + 1);
                return toLocalDateTimeString(startDate);
            }
        }
        return getMinStartTime();
    };

    useEffect(() => {
        if(isOpen) {
            // Handle null or undefined initialValues (e.g., when creating a new promotion)
            const values = initialValues || {};
            
            // For new promotions, set default start time to 10 minutes from now to avoid "in the past" errors
            let defaultStartTime = '';
            let defaultEndTime = '';
            if(mode === 'create' && !values.startTime) {
                const futureTime = new Date();
                futureTime.setMinutes(futureTime.getMinutes() + 10); // 10 minutes from now
                defaultStartTime = toLocalDateTimeString(futureTime);
                
                // For new promotions, set default end time to 1 hour after start time
                if(!values.endTime) {
                    const endTime = new Date(futureTime);
                    endTime.setHours(endTime.getHours() + 1); // 1 hour after start time
                    defaultEndTime = toLocalDateTimeString(endTime);
                }
            }
            
            setFormValues({
                name: values.name || '',
                description: values.description || '',
                type: normalizeTypeForForm(values.type),
                startTime: values.startTime ? toInputValue(values.startTime) : defaultStartTime,
                endTime: values.endTime ? toInputValue(values.endTime) : defaultEndTime,
                minSpending: values.minSpending ?? '',
                rate: values.rate != null ? String(percentFromDecimal(values.rate)) : '',
                points: values.points ?? ''
            });
        } else {
            setFormValues(DEFAULT_FORM);
        }
    }, [isOpen, initialValues, mode]);

    if(!isOpen) {
        return null;
    }

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormValues((prev) => ({
            ...prev,
            [name]: value
        }));
        setPayloadValues((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        onSubmit?.(payloadValues);
    };

    return (
        <div className="promotion-modal-overlay" role="dialog" aria-modal="true">
            <div className="promotion-modal">
                <header className="promotion-modal__header">
                    <h3>{mode === 'edit' ? t('editor.editPromotion') : t('editor.createPromotion')}</h3>
                    <button className="modal-close-btn" type="button" onClick={onClose} aria-label={t('common.close')}>×</button>
                </header>
                <form className="promotion-modal__form" onSubmit={handleSubmit}>
                    <label>
                        {t('editor.promotionName')}
                        <input
                            type="text"
                            name="name"
                            value={formValues.name}
                            onChange={handleChange}
                            required
                        />
                    </label>
                    <label>
                        {t('editor.description')}
                        <textarea
                            name="description"
                            value={formValues.description}
                            onChange={handleChange}
                            rows={3}
                            required
                        />
                    </label>
                    <div className="modal-grid">
                        <label>
                            {t('editor.type')}
                            <select name="type" value={formValues.type} onChange={handleChange}>
                                <option value="automatic">{t('promotions.typeAutomatic')}</option>
                                <option value="onetime">{t('promotions.typeOneTime')}</option>
                            </select>
                        </label>
                        <label>
                            {t('editor.bonusRate')}
                            <input
                                type="number"
                                name="rate"
                                min="0"
                                step="0.1"
                                value={formValues.rate}
                                onChange={handleChange}
                                placeholder="0"
                            />
                        </label>
                        <label>
                            {t('editor.points')}
                            <input
                                type="number"
                                name="points"
                                min="0"
                                step="1"
                                value={formValues.points}
                                onChange={handleChange}
                                placeholder="0"
                            />
                        </label>
                        <label>
                            {t('editor.minSpending')}
                            <input
                                type="number"
                                name="minSpending"
                                min="0"
                                step="1"
                                value={formValues.minSpending}
                                onChange={handleChange}
                                placeholder="0"
                            />
                        </label>
                    </div>
                    <div className="modal-grid">
                        <label>
                            {t('editor.startTime')}
                            <input
                                type="datetime-local"
                                name="startTime"
                                value={formValues.startTime}
                                onChange={handleChange}
                                min={mode === 'create' ? getMinStartTime() : undefined}
                                required
                            />
                        </label>
                        <label>
                            {t('editor.endTime')}
                            <input
                                type="datetime-local"
                                name="endTime"
                                value={formValues.endTime}
                                onChange={handleChange}
                                min={getMinEndTime()}
                                required
                            />
                        </label>
                    </div>
                    {error && <p className="modal-error">{error}</p>}
                    <div className="modal-actions">
                        <button type="button" className="secondary-btn" onClick={onClose} disabled={busy}>
                            {t('common.cancel')}
                        </button>
                        <button type="submit" className="primary-btn" disabled={busy}>
                            {busy ? t('common.saving') : mode === 'edit' ? t('editor.saveChanges') : t('editor.createPromotion')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default PromotionEditorModal;

