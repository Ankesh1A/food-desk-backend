import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        lowercase: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    phone: {
        type: String,
        maxlength: [15, 'Phone number cannot be more than 15 characters']
    },
    avatar: {
        type: String,
        default: 'default-avatar.png'
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'restaurant', 'delivery'],
        default: 'user'
    },
    address: [{
        type: {
            type: String,
            enum: ['home', 'work', 'other'],
            default: 'home'
        },
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
        isDefault: {
            type: Boolean,
            default: false
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    // OTP Fields - New
    otp: {
        code: String,
        expiresAt: Date,
        attempts: {
            type: Number,
            default: 0
        },
        lastSentAt: Date
    },
    // Password Reset OTP
    resetPasswordOtp: {
        code: String,
        expiresAt: Date,
        attempts: {
            type: Number,
            default: 0
        }
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    lastLogin: Date,
    preferences: {
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            sms: { type: Boolean, default: false }
        },
        language: { type: String, default: 'en' },
        currency: { type: String, default: 'INR' },
        theme: { type: String, enum: ['light', 'dark'], default: 'light' }
    }
}, {
    timestamps: true
});

// Encrypt password using bcrypt
userSchema.pre('save', async function() {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function() {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Generate 6-digit OTP
userSchema.methods.generateOTP = function() {
    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash OTP before saving
    this.otp = {
        code: crypto.createHash('sha256').update(otp).digest('hex'),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        attempts: 0,
        lastSentAt: new Date()
    };
    
    return otp; // Return plain OTP to send via email
};

// Verify OTP
userSchema.methods.verifyOTP = function(enteredOtp) {
    const hashedOtp = crypto.createHash('sha256').update(enteredOtp).digest('hex');
    
    if (!this.otp || !this.otp.code) {
        return { success: false, message: 'No OTP found. Please request a new one.' };
    }
    
    if (this.otp.attempts >= 5) {
        return { success: false, message: 'Too many attempts. Please request a new OTP.' };
    }
    
    if (new Date() > this.otp.expiresAt) {
        return { success: false, message: 'OTP has expired. Please request a new one.' };
    }
    
    if (hashedOtp !== this.otp.code) {
        this.otp.attempts += 1;
        return { success: false, message: `Invalid OTP. ${5 - this.otp.attempts} attempts remaining.` };
    }
    
    return { success: true, message: 'OTP verified successfully.' };
};

// Generate Password Reset OTP
userSchema.methods.generatePasswordResetOTP = function() {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    this.resetPasswordOtp = {
        code: crypto.createHash('sha256').update(otp).digest('hex'),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        attempts: 0
    };
    
    return otp;
};

// Verify Password Reset OTP
userSchema.methods.verifyPasswordResetOTP = function(enteredOtp) {
    const hashedOtp = crypto.createHash('sha256').update(enteredOtp).digest('hex');
    
    if (!this.resetPasswordOtp || !this.resetPasswordOtp.code) {
        return { success: false, message: 'No OTP found. Please request a new one.' };
    }
    
    if (this.resetPasswordOtp.attempts >= 5) {
        return { success: false, message: 'Too many attempts. Please request a new OTP.' };
    }
    
    if (new Date() > this.resetPasswordOtp.expiresAt) {
        return { success: false, message: 'OTP has expired. Please request a new one.' };
    }
    
    if (hashedOtp !== this.resetPasswordOtp.code) {
        this.resetPasswordOtp.attempts += 1;
        return { success: false, message: `Invalid OTP. ${5 - this.resetPasswordOtp.attempts} attempts remaining.` };
    }
    
    return { success: true, message: 'OTP verified successfully.' };
};

// Clear OTP after successful verification
userSchema.methods.clearOTP = function() {
    this.otp = undefined;
};

// Clear Password Reset OTP
userSchema.methods.clearPasswordResetOTP = function() {
    this.resetPasswordOtp = undefined;
};

// Generate and hash password token (keeping for backward compatibility)
userSchema.methods.getResetPasswordToken = function() {
    const resetToken = crypto.randomBytes(20).toString('hex');

    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    return resetToken;
};

const User = mongoose.model('User', userSchema);
export default User;