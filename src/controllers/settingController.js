import Setting from '../models/Setting.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

// @desc    Get user settings
// @route   GET /api/settings
// @access  Private
export const getSettings = asyncHandler(async (req, res) => {
    let settings = await Setting.findOne({ user: req.user.id });

    if (!settings) {
        settings = await Setting.create({ user: req.user.id });
    }

    res.status(200).json({
        success: true,
        data: settings
    });
});

// @desc    Update user settings
// @route   PUT /api/settings
// @access  Private
export const updateSettings = asyncHandler(async (req, res) => {
    let settings = await Setting.findOne({ user: req.user.id });

    if (!settings) {
        settings = await Setting.create({ user: req.user.id, ...req.body });
    } else {
        // Deep merge settings
        const updateData = {};
        
        if (req.body.notifications) {
            updateData.notifications = {
                ...settings.notifications.toObject(),
                ...req.body.notifications
            };
        }
        
        if (req.body.privacy) {
            updateData.privacy = {
                ...settings.privacy.toObject(),
                ...req.body.privacy
            };
        }
        
        if (req.body.preferences) {
            updateData.preferences = {
                ...settings.preferences.toObject(),
                ...req.body.preferences
            };
        }
        
        if (req.body.dietary) {
            updateData.dietary = {
                ...settings.dietary.toObject(),
                ...req.body.dietary
            };
        }

        if (req.body.payment) {
            updateData.payment = {
                ...settings.payment.toObject(),
                ...req.body.payment
            };
        }

        if (req.body.twoFactorAuth) {
            updateData.twoFactorAuth = {
                ...settings.twoFactorAuth.toObject(),
                ...req.body.twoFactorAuth
            };
        }

        settings = await Setting.findOneAndUpdate(
            { user: req.user.id },
            updateData,
            { new: true, runValidators: true }
        );
    }

    // Update user preferences if theme or language changed
    if (req.body.preferences) {
        const userUpdate = {};
        if (req.body.preferences.theme) {
            userUpdate['preferences.theme'] = req.body.preferences.theme;
        }
        if (req.body.preferences.language) {
            userUpdate['preferences.language'] = req.body.preferences.language;
        }
        if (Object.keys(userUpdate).length > 0) {
            await User.findByIdAndUpdate(req.user.id, userUpdate);
        }
    }

    res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        data: settings
    });
});

// @desc    Update notification settings
// @route   PUT /api/settings/notifications
// @access  Private
export const updateNotificationSettings = asyncHandler(async (req, res) => {
    const settings = await Setting.findOneAndUpdate(
        { user: req.user.id },
        { notifications: req.body },
        { new: true, runValidators: true, upsert: true }
    );

    res.status(200).json({
        success: true,
        message: 'Notification settings updated',
        data: settings.notifications
    });
});

// @desc    Update privacy settings
// @route   PUT /api/settings/privacy
// @access  Private
export const updatePrivacySettings = asyncHandler(async (req, res) => {
    const settings = await Setting.findOneAndUpdate(
        { user: req.user.id },
        { privacy: req.body },
        { new: true, runValidators: true, upsert: true }
    );

    res.status(200).json({
        success: true,
        message: 'Privacy settings updated',
        data: settings.privacy
    });
});

// @desc    Update dietary preferences
// @route   PUT /api/settings/dietary
// @access  Private
export const updateDietaryPreferences = asyncHandler(async (req, res) => {
    const settings = await Setting.findOneAndUpdate(
        { user: req.user.id },
        { dietary: req.body },
        { new: true, runValidators: true, upsert: true }
    );

    res.status(200).json({
        success: true,
        message: 'Dietary preferences updated',
        data: settings.dietary
    });
});

// @desc    Add saved card
// @route   POST /api/settings/payment/cards
// @access  Private
export const addSavedCard = asyncHandler(async (req, res) => {
    const { last4, brand, expiryMonth, expiryYear, isDefault } = req.body;

    let settings = await Setting.findOne({ user: req.user.id });

    if (!settings) {
        settings = await Setting.create({ user: req.user.id });
    }

    // If new card is default, remove default from others
    if (isDefault) {
        settings.payment.savedCards.forEach(card => {
            card.isDefault = false;
        });
    }

    settings.payment.savedCards.push({
        last4,
        brand,
        expiryMonth,
        expiryYear,
        isDefault: isDefault || settings.payment.savedCards.length === 0
    });

    await settings.save();

    res.status(201).json({
        success: true,
        message: 'Card added successfully',
        data: settings.payment.savedCards
    });
});

// @desc    Remove saved card
// @route   DELETE /api/settings/payment/cards/:cardId
// @access  Private
export const removeSavedCard = asyncHandler(async (req, res) => {
    const settings = await Setting.findOne({ user: req.user.id });

    if (!settings) {
        res.status(404);
        throw new Error('Settings not found');
    }

    const cardIndex = settings.payment.savedCards.findIndex(
        card => card._id.toString() === req.params.cardId
    );

    if (cardIndex === -1) {
        res.status(404);
        throw new Error('Card not found');
    }

    settings.payment.savedCards.splice(cardIndex, 1);
    await settings.save();

    res.status(200).json({
        success: true,
        message: 'Card removed successfully',
        data: settings.payment.savedCards
    });
});

// @desc    Set default payment method
// @route   PUT /api/settings/payment/default
// @access  Private
export const setDefaultPaymentMethod = asyncHandler(async (req, res) => {
    const { method } = req.body;

    const validMethods = ['cod', 'card', 'upi', 'wallet'];
    if (!validMethods.includes(method)) {
        res.status(400);
        throw new Error('Invalid payment method');
    }

    const settings = await Setting.findOneAndUpdate(
        { user: req.user.id },
        { 'payment.defaultMethod': method },
        { new: true, runValidators: true, upsert: true }
    );

    res.status(200).json({
        success: true,
        message: 'Default payment method updated',
        data: { defaultMethod: settings.payment.defaultMethod }
    });
});

// @desc    Enable/Disable two-factor authentication
// @route   PUT /api/settings/2fa
// @access  Private
export const toggleTwoFactorAuth = asyncHandler(async (req, res) => {
    const { enabled, method } = req.body;

    const settings = await Setting.findOneAndUpdate(
        { user: req.user.id },
        {
            'twoFactorAuth.enabled': enabled,
            'twoFactorAuth.method': method || 'sms'
        },
        { new: true, runValidators: true, upsert: true }
    );

    res.status(200).json({
        success: true,
        message: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`,
        data: settings.twoFactorAuth
    });
});

// @desc    Reset settings to default
// @route   POST /api/settings/reset
// @access  Private
export const resetSettings = asyncHandler(async (req, res) => {
    await Setting.findOneAndDelete({ user: req.user.id });
    
    const settings = await Setting.create({ user: req.user.id });

    res.status(200).json({
        success: true,
        message: 'Settings reset to default',
        data: settings
    });
});