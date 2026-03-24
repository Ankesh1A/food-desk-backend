import express from 'express';
import {
    register,
    login,
    logout,
    getMe,
    verifyOTP,
    resendOTP,
    forgotPassword,
    verifyResetOTP,
    resetPassword,
    updatePassword,
    resendVerification
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { userValidation, validate } from '../middleware/validateMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', userValidation.register, validate, register);
router.post('/login', userValidation.login, validate, login);
router.post('/logout', logout);

// OTP Verification routes
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.put('/update-password', protect, updatePassword);
router.post('/resend-verification', protect, resendVerification);

export default router;