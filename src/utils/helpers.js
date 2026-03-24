import crypto from 'crypto';

// Generate random string
export const generateRandomString = (length = 20) => {
    return crypto.randomBytes(length).toString('hex');
};

// Generate OTP
export const generateOTP = (length = 6) => {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
};

// Calculate distance between two coordinates (Haversine formula)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const toRad = (value) => (value * Math.PI) / 180;

// Format currency
export const formatCurrency = (amount, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency
    }).format(amount);
};

// Slugify string
export const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
};

// Parse sort string
export const parseSort = (sortString) => {
    if (!sortString) return { createdAt: -1 };
    
    const sortObj = {};
    sortString.split(',').forEach(field => {
        if (field.startsWith('-')) {
            sortObj[field.substring(1)] = -1;
        } else {
            sortObj[field] = 1;
        }
    });
    return sortObj;
};

// Remove undefined fields from object
export const removeUndefined = (obj) => {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined)
    );
};

// Deep clone object
export const deepClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
};

// Check if object is empty
export const isEmpty = (obj) => {
    return Object.keys(obj).length === 0;
};

// Get time ago string
export const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + ' years ago';
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' months ago';
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ' days ago';
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + ' hours ago';
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + ' minutes ago';
    
    return Math.floor(seconds) + ' seconds ago';
};

// Calculate estimated delivery time
export const calculateEstimatedDelivery = (distance, preparationTime = 20) => {
    const deliverySpeed = 30; // km/h average
    const deliveryTime = (distance / deliverySpeed) * 60; // in minutes
    return Math.ceil(preparationTime + deliveryTime);
};

export default {
    generateRandomString,
    generateOTP,
    calculateDistance,
    formatCurrency,
    slugify,
    parseSort,
    removeUndefined,
    deepClone,
    isEmpty,
    timeAgo,
    calculateEstimatedDelivery
};