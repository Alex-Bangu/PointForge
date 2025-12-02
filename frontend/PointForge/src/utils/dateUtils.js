/**
 * Date utility functions for formatting and comparing dates
 */

/**
 * Format a date string to a human-readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string or empty string if invalid
 */
export const formatDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original if invalid date
    
    const options = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };
    
    return date.toLocaleString('en-US', options);
};

/**
 * Check if an event/promotion is currently active (not ended)
 * @param {string|Date} endTime - End time to check
 * @returns {boolean} True if the end time is in the future
 */
export const isActive = (endTime) => {
    if (!endTime) return false;
    return Date.parse(endTime) > Date.now();
};

/**
 * Check if an event/promotion is upcoming (hasn't started yet)
 * @param {string|Date} startTime - Start time to check
 * @returns {boolean} True if the start time is in the future
 */
export const isUpcoming = (startTime) => {
    if (!startTime) return false;
    return new Date(startTime) > new Date();
};

/**
 * Check if an event/promotion has ended
 * @param {string|Date} endTime - End time to check
 * @returns {boolean} True if the end time is in the past
 */
export const hasEnded = (endTime) => {
    if (!endTime) return false;
    const now = new Date();
    const end = new Date(endTime);
    return now > end;
};

/**
 * Filter items that are currently active (not ended)
 * @param {Array} items - Array of items with endTime property
 * @returns {Array} Filtered array of active items
 */
export const filterActive = (items) => {
    return items.filter(item => item?.endTime && isActive(item.endTime));
};

/**
 * Filter items that are upcoming (end time is in the future)
 * @param {Array} items - Array of items with endTime property
 * @returns {Array} Filtered array of upcoming items
 */
export const filterUpcoming = (items) => {
    return items.filter(item => item?.endTime && isActive(item.endTime));
};
