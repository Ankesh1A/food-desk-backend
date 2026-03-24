import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    notifications: {
        email: {
            orderUpdates: { type: Boolean, default: true },
            promotions: { type: Boolean, default: true },
            newsletter: { type: Boolean, default: false },
            reviews: { type: Boolean, default: true }
        },
        push: {
            orderUpdates: { type: Boolean, default: true },
            promotions: { type: Boolean, default: true },
            messages: { type: Boolean, default: true },
            reminders: { type: Boolean, default: true }
        },
        sms: {
            orderUpdates: { type: Boolean, default: true },
            promotions: { type: Boolean, default: false }
        }
    },
    privacy: {
        profileVisibility: {
            type: String,
            enum: ['public', 'private', 'friends'],
            default: 'public'
        },
        showOnlineStatus: { type: Boolean, default: true },
        showLastSeen: { type: Boolean, default: true },
        allowReviews: { type: Boolean, default: true }
    },
    preferences: {
        language: { type: String, default: 'en' },
        currency: { type: String, default: 'INR' },
        theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
        fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' }
    },
    dietary: {
        isVegetarian: { type: Boolean, default: false },
        isVegan: { type: Boolean, default: false },
        isGlutenFree: { type: Boolean, default: false },
        allergies: [String],
        cuisinePreferences: [String]
    },
    payment: {
        defaultMethod: { type: String, enum: ['cod', 'card', 'upi', 'wallet'], default: 'cod' },
        savedCards: [{
            last4: String,
            brand: String,
            expiryMonth: Number,
            expiryYear: Number,
            isDefault: Boolean
        }],
        savedUpi: [{
            upiId: String,
            isDefault: Boolean
        }]
    },
    twoFactorAuth: {
        enabled: { type: Boolean, default: false },
        method: { type: String, enum: ['sms', 'email', 'authenticator'] }
    }
}, {
    timestamps: true
});

const Setting = mongoose.model('Setting', settingSchema);
export default Setting;