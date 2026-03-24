import express from 'express';
import {
    getSettings,
    updateSettings,
    updateNotificationSettings,
    updatePrivacySettings,
    updateDietaryPreferences,
    addSavedCard,
    removeSavedCard,
    setDefaultPaymentMethod,
    toggleTwoFactorAuth,
    resetSettings
} from '../controllers/settingController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getSettings);
router.put('/', updateSettings);
router.put('/notifications', updateNotificationSettings);
router.put('/privacy', updatePrivacySettings);
router.put('/dietary', updateDietaryPreferences);
router.post('/payment/cards', addSavedCard);
router.delete('/payment/cards/:cardId', removeSavedCard);
router.put('/payment/default', setDefaultPaymentMethod);
router.put('/2fa', toggleTwoFactorAuth);
router.post('/reset', resetSettings);

export default router;