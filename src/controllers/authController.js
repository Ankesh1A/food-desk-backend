import crypto from 'crypto';
import User from '../models/User.js';
import Setting from '../models/Setting.js';
import { sendTokenResponse } from '../utils/generateToken.js';
import sendEmail, { emailTemplates } from '../utils/sendEmail.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req, res) => {
    const { name, email, password, phone, role } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists with this email');
    }

    // Create user
    const user = await User.create({
        name,
        email,
        password,
        phone,
        role: role || 'user'
    });

    // Create default settings for user
    await Setting.create({ user: user._id });

    // Generate OTP
    const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });

    // Send OTP email
    try {
        const template = emailTemplates.otpVerification(otp, user.name);
        await sendEmail({
            email: user.email,
            subject: template.subject,
            html: template.html
        });
    } catch (error) {
        console.error('OTP Email send error:', error);
        // Don't throw error, user is created, they can resend OTP
    }

    // Send response with user data (without token, as email not verified)
    res.status(201).json({
        success: true,
        message: 'Registration successful! Please verify your email with the OTP sent.',
        data: {
            userId: user._id,
            email: user.email,
            name: user.name,
            isVerified: user.isVerified
        }
    });
});

// @desc    Verify Email with OTP
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        res.status(400);
        throw new Error('Please provide email and OTP');
    }

    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (user.isVerified) {
        res.status(400);
        throw new Error('Email is already verified');
    }

    // Verify OTP
    const verification = user.verifyOTP(otp);

    if (!verification.success) {
        await user.save({ validateBeforeSave: false }); // Save attempts
        res.status(400);
        throw new Error(verification.message);
    }

    // OTP verified successfully
    user.isVerified = true;
    user.clearOTP();
    await user.save({ validateBeforeSave: false });

    // Send welcome email
    try {
        const welcomeTemplate = emailTemplates.welcome(user.name);
        await sendEmail({
            email: user.email,
            subject: welcomeTemplate.subject,
            html: welcomeTemplate.html
        });
    } catch (error) {
        console.error('Welcome email error:', error);
    }

    // Send token response
    sendTokenResponse(user, 200, res, 'Email verified successfully!');
});

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOTP = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error('Please provide email');
    }

    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (user.isVerified) {
        res.status(400);
        throw new Error('Email is already verified');
    }

    // Check if OTP was sent recently (rate limiting - 1 minute)
    if (user.otp && user.otp.lastSentAt) {
        const timeDiff = Date.now() - new Date(user.otp.lastSentAt).getTime();
        const waitTime = 60 * 1000; // 1 minute

        if (timeDiff < waitTime) {
            const remainingTime = Math.ceil((waitTime - timeDiff) / 1000);
            res.status(429);
            throw new Error(`Please wait ${remainingTime} seconds before requesting a new OTP`);
        }
    }

    // Generate new OTP
    const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });

    // Send OTP email
    try {
        const template = emailTemplates.otpVerification(otp, user.name);
        await sendEmail({
            email: user.email,
            subject: template.subject,
            html: template.html
        });

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully to your email'
        });
    } catch (error) {
        console.error('OTP Email error:', error);
        res.status(500);
        throw new Error('Failed to send OTP. Please try again.');
    }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400);
        throw new Error('Please provide email and password');
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        res.status(401);
        throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
        res.status(401);
        throw new Error('Your account has been deactivated');
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
        res.status(401);
        throw new Error('Invalid credentials');
    }

    // Check if email is verified
    if (!user.isVerified) {
        // Generate new OTP and send
        const otp = user.generateOTP();
        await user.save({ validateBeforeSave: false });

        try {
            const template = emailTemplates.otpVerification(otp, user.name);
            await sendEmail({
                email: user.email,
                subject: template.subject,
                html: template.html
            });
        } catch (error) {
            console.error('OTP Email error:', error);
        }

        res.status(403).json({
            success: false,
            message: 'Email not verified. OTP sent to your email.',
            requiresVerification: true,
            email: user.email
        });
        return;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res, 'Login successful');
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = asyncHandler(async (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });

    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    res.status(200).json({
        success: true,
        data: user
    });
});

// @desc    Forgot password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('No user found with this email');
    }

    // Generate Password Reset OTP
    const otp = user.generatePasswordResetOTP();
    await user.save({ validateBeforeSave: false });

    try {
        const template = emailTemplates.passwordResetOtp(otp, user.name);
        await sendEmail({
            email: user.email,
            subject: template.subject,
            html: template.html
        });

        res.status(200).json({
            success: true,
            message: 'Password reset OTP sent to your email',
            email: user.email
        });
    } catch (error) {
        console.error(error);
        user.resetPasswordOtp = undefined;
        await user.save({ validateBeforeSave: false });

        res.status(500);
        throw new Error('Email could not be sent');
    }
});

// @desc    Verify Password Reset OTP
// @route   POST /api/auth/verify-reset-otp
// @access  Public
export const verifyResetOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        res.status(400);
        throw new Error('Please provide email and OTP');
    }

    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const verification = user.verifyPasswordResetOTP(otp);

    if (!verification.success) {
        await user.save({ validateBeforeSave: false });
        res.status(400);
        throw new Error(verification.message);
    }

    // Generate a temporary token for password reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        success: true,
        message: 'OTP verified successfully',
        resetToken // Send this token to use for actual password reset
    });
});

// @desc    Reset password with token
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = asyncHandler(async (req, res) => {
    const { resetToken, password } = req.body;

    if (!resetToken || !password) {
        res.status(400);
        throw new Error('Please provide reset token and new password');
    }

    const resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired reset token');
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.resetPasswordOtp = undefined;
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Password reset successful'
    });
});

// @desc    Update password
// @route   PUT /api/auth/update-password
// @access  Private
export const updatePassword = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('+password');

    if (!(await user.matchPassword(req.body.currentPassword))) {
        res.status(401);
        throw new Error('Current password is incorrect');
    }

    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, 200, res, 'Password updated successfully');
});

// @desc    Resend verification (for logged in users) - DEPRECATED, use resendOTP
// @route   POST /api/auth/resend-verification
// @access  Private
export const resendVerification = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (user.isVerified) {
        res.status(400);
        throw new Error('Email is already verified');
    }

    const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });

    try {
        const template = emailTemplates.otpVerification(otp, user.name);
        await sendEmail({
            email: user.email,
            subject: template.subject,
            html: template.html
        });

        res.status(200).json({
            success: true,
            message: 'Verification OTP sent'
        });
    } catch (error) {
        user.otp = undefined;
        await user.save({ validateBeforeSave: false });

        res.status(500);
        throw new Error('Email could not be sent');
    }
});