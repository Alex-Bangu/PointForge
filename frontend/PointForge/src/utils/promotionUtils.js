const toServerDate = (value) => {
    if(!value || value === '') {
        return null;
    }
    const [datePart, timePart] = value.split('T');
    if(!datePart || !timePart) {
        console.error('Invalid datetime-local format:', value);
        return null;
    }
    
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
    
    if(Number.isNaN(date.getTime())) {
        console.error('Invalid date value:', value);
        return null;
    }
    return date.toISOString();
};

export const buildPromotionPayload = (formValues = {}) => {
    const payload = {};

    if(formValues.name !== undefined) {
        payload.name = String(formValues.name || '').trim();
    }

    if(formValues.description !== undefined) {
        payload.description = String(formValues.description || '').trim();
    }

    if(formValues.type !== undefined) {
        const typeValue = formValues.type === 'onetime' ? 'one-time' : (formValues.type || 'automatic');
        payload.type = typeValue;
    }

    if(formValues.startTime !== undefined && formValues.startTime !== '') {
        const startTime = toServerDate(formValues.startTime);
        if(startTime) {
            payload.startTime = startTime;
        } else {
            console.warn('Failed to convert startTime to ISO format:', formValues.startTime);
            payload.startTime = formValues.startTime;
        }
    }
    
    if(formValues.endTime !== undefined && formValues.endTime !== '') {
        const endTime = toServerDate(formValues.endTime);
        if(endTime) {
            payload.endTime = endTime;
        } else {
            console.warn('Failed to convert endTime to ISO format:', formValues.endTime);
            payload.endTime = formValues.endTime;
        }
    }

    if(formValues.minSpending !== '' && formValues.minSpending !== undefined && formValues.minSpending !== null) {
        const numeric = Number(formValues.minSpending);
        if(!Number.isNaN(numeric) && numeric >= 0) {
            payload.minSpending = Math.round(numeric);
        }
    }

    if(formValues.points !== '' && formValues.points !== undefined && formValues.points !== null) {
        const numeric = Number(formValues.points);
        if(!Number.isNaN(numeric) && numeric >= 0) {
            payload.points = Math.round(numeric);
        }
    }

    if(formValues.rate !== '' && formValues.rate !== undefined && formValues.rate !== null) {
        const numeric = Number(formValues.rate);
        if(!Number.isNaN(numeric) && numeric >= 0) {
            payload.rate = numeric / 100;
        }
    }

    return Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
    );
};

export const percentFromDecimal = (value) => {
    if(value === null || value === undefined) {
        return 0;
    }
    return Math.round(Number(value) * 100);
};

