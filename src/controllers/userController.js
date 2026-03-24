// controllers/userController.js
import User from '../models/User.js';
import Order from '../models/Order.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import APIFeatures from '../utils/apiFeatures.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';

// ==================== ADMIN FUNCTIONS ====================

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = asyncHandler(async (req, res) => {
    const features = new APIFeatures(User.find().select('-password'), req.query)
        .filter()
        .search(['name', 'email'])
        .sort()
        .limitFields()
        .paginate();

    const users = await features.query;
    const pagination = await features.getPaginationInfo(User);

    res.status(200).json({
        success: true,
        count: users.length,
        pagination,
        data: users
    });
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    res.status(200).json({
        success: true,
        data: user
    });
});

// @desc    Create user (Admin)
// @route   POST /api/users
// @access  Private/Admin

export const createUser = asyncHandler(async (req, res) => {
    const { name, email, password, phone, role, isActive, isVerified } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
        res.status(400);
        throw new Error('Please provide name, email and password');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        res.status(400);
        throw new Error('User with this email already exists');
    }

    // Prepare user data
    const userData = {
        name,
        email: email.toLowerCase(),
        password,
        phone: phone || '',
        role: role || 'user',
        isActive: isActive === 'true' || isActive === true,
        isVerified: isVerified === 'true' || isVerified === true
    };

    //  Handle avatar upload
    if (req.file) {
        userData.avatar = req.file.path; // Cloudinary URL
    }

    // Create user
    const user = await User.create(userData);

    // Get user without password
    const userResponse = await User.findById(user._id).select('-password');

    res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: userResponse
    });
});

// @desc    Update user (Admin)
// @route   PUT /api/users/:id
// @access  Private/Admin
// @desc    Update user (Admin)
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = asyncHandler(async (req, res) => {
    let user = await User.findById(req.params.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Debug logs
    console.log('=== UPDATE USER ===');
    console.log('Body:', req.body);
    console.log('File:', req.file);

    const updateData = {};

    // Handle text fields
    if (req.body.name) {
        updateData.name = req.body.name;
    }
    if (req.body.phone !== undefined) {
        updateData.phone = req.body.phone;
    }
    if (req.body.role) {
        updateData.role = req.body.role;
    }

    // Handle boolean fields (FormData sends as string)
    if (req.body.isActive !== undefined) {
        updateData.isActive = req.body.isActive === 'true' || req.body.isActive === true;
    }
    if (req.body.isVerified !== undefined) {
        updateData.isVerified = req.body.isVerified === 'true' || req.body.isVerified === true;
    }

    // Handle email update with duplicate check
    if (req.body.email && req.body.email.toLowerCase() !== user.email) {
        const emailExists = await User.findOne({
            email: req.body.email.toLowerCase(),
            _id: { $ne: req.params.id }
        });
        if (emailExists) {
            res.status(400);
            throw new Error('Email already in use');
        }
        updateData.email = req.body.email.toLowerCase();
    }

    //  Handle Avatar Upload
    if (req.file) {
        console.log('New avatar file received:', req.file.path);
        
        // Delete old avatar from Cloudinary if exists
        if (user.avatar && user.avatar.includes('cloudinary')) {
            try {
                await deleteFromCloudinary(user.avatar);
                console.log('Old avatar deleted from Cloudinary');
            } catch (err) {
                console.error('Error deleting old avatar:', err);
            }
        }
        
        // Set new avatar URL
        updateData.avatar = req.file.path;
    }

    console.log('Update data:', updateData);

    // Update user
    user = await User.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true
    }).select('-password');

    console.log('Updated user avatar:', user.avatar);

    res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: user
    });
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user.id) {
        res.status(400);
        throw new Error('You cannot delete yourself');
    }

    // Delete avatar from Cloudinary if exists
    if (user.avatar && user.avatar.includes('cloudinary')) {
        await deleteFromCloudinary(user.avatar);
    }

    await user.deleteOne();

    res.status(200).json({
        success: true,
        message: 'User deleted successfully'
    });
});

// ==================== USER PROFILE FUNCTIONS ====================

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    res.status(200).json({
        success: true,
        data: user
    });
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const allowedFields = ['name', 'phone', 'preferences'];
    const updateData = {};

    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            updateData[field] = req.body[field];
        }
    });

    // ✅ Handle avatar upload to Cloudinary
    if (req.file) {
        // Delete old avatar from Cloudinary if exists
        if (user.avatar && user.avatar.includes('cloudinary')) {
            try {
                await deleteFromCloudinary(user.avatar);
                console.log('Old avatar deleted from Cloudinary');
            } catch (error) {
                console.error('Error deleting old avatar:', error);
            }
        }

        // ✅ Save Cloudinary URL (req.file.path contains the full Cloudinary URL)
        updateData.avatar = req.file.path;
        console.log('New avatar URL:', req.file.path);
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updateData, {
        new: true,
        runValidators: true
    }).select('-password');

    res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
    });
});

// @desc    Update avatar only
// @route   PUT /api/users/profile/avatar
// @access  Private
export const updateAvatar = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('Please upload an image');
    }

    const user = await User.findById(req.user.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Delete old avatar from Cloudinary if exists
    if (user.avatar && user.avatar.includes('cloudinary')) {
        try {
            await deleteFromCloudinary(user.avatar);
        } catch (error) {
            console.error('Error deleting old avatar:', error);
        }
    }

    // Update with new Cloudinary URL
    user.avatar = req.file.path;
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Avatar updated successfully',
        data: {
            avatar: user.avatar
        }
    });
});

// @desc    Remove avatar
// @route   DELETE /api/users/profile/avatar
// @access  Private
export const removeAvatar = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Delete from Cloudinary if exists
    if (user.avatar && user.avatar.includes('cloudinary')) {
        try {
            await deleteFromCloudinary(user.avatar);
        } catch (error) {
            console.error('Error deleting avatar:', error);
        }
    }

    // Set to default
    user.avatar = 'default-avatar.png';
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Avatar removed successfully'
    });
});

// ==================== ADDRESS FUNCTIONS ====================

// @desc    Add user address
// @route   POST /api/users/address
// @access  Private
export const addAddress = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const { type, street, city, state, zipCode, country, isDefault } = req.body;

    // Validate required fields
    if (!street || !city || !state || !zipCode) {
        res.status(400);
        throw new Error('Please provide street, city, state and zipCode');
    }

    const newAddress = {
        type: type || 'home',
        street,
        city,
        state,
        zipCode,
        country: country || 'India',
        isDefault: isDefault || false
    };

    // If new address is default, remove default from others
    if (newAddress.isDefault) {
        user.address.forEach(addr => {
            addr.isDefault = false;
        });
    }

    // If first address, make it default
    if (user.address.length === 0) {
        newAddress.isDefault = true;
    }

    user.address.push(newAddress);
    await user.save();

    res.status(201).json({
        success: true,
        message: 'Address added successfully',
        data: user.address
    });
});

// @desc    Update user address
// @route   PUT /api/users/address/:addressId
// @access  Private
export const updateAddress = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const addressIndex = user.address.findIndex(
        addr => addr._id.toString() === req.params.addressId
    );

    if (addressIndex === -1) {
        res.status(404);
        throw new Error('Address not found');
    }

    // If updating to default, remove default from others
    if (req.body.isDefault === true) {
        user.address.forEach(addr => {
            addr.isDefault = false;
        });
    }

    // Update address fields
    const allowedFields = ['type', 'street', 'city', 'state', 'zipCode', 'country', 'isDefault'];
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            user.address[addressIndex][field] = req.body[field];
        }
    });

    await user.save();

    res.status(200).json({
        success: true,
        message: 'Address updated successfully',
        data: user.address
    });
});

// @desc    Delete user address
// @route   DELETE /api/users/address/:addressId
// @access  Private
export const deleteAddress = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const addressIndex = user.address.findIndex(
        addr => addr._id.toString() === req.params.addressId
    );

    if (addressIndex === -1) {
        res.status(404);
        throw new Error('Address not found');
    }

    const wasDefault = user.address[addressIndex].isDefault;
    user.address.splice(addressIndex, 1);

    // If deleted was default, make first one default
    if (wasDefault && user.address.length > 0) {
        user.address[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
        success: true,
        message: 'Address deleted successfully',
        data: user.address
    });
});

// @desc    Set default address
// @route   PUT /api/users/address/:addressId/default
// @access  Private
export const setDefaultAddress = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const addressIndex = user.address.findIndex(
        addr => addr._id.toString() === req.params.addressId
    );

    if (addressIndex === -1) {
        res.status(404);
        throw new Error('Address not found');
    }

    // Remove default from all
    user.address.forEach(addr => {
        addr.isDefault = false;
    });

    // Set this as default
    user.address[addressIndex].isDefault = true;
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Default address updated',
        data: user.address
    });
});

// ==================== USER STATS & ACCOUNT FUNCTIONS ====================

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private
export const getUserStats = asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user.id });

    const stats = {
        totalOrders: orders.length,
        totalSpent: orders.reduce((acc, order) => {
            return acc + (order.pricing?.total || order.totalAmount || 0);
        }, 0),
        completedOrders: orders.filter(o => o.status === 'delivered').length,
        cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
        pendingOrders: orders.filter(o => 
            ['pending', 'confirmed', 'preparing', 'on_the_way', 'ready'].includes(o.status)
        ).length
    };

    // Average order value
    if (stats.completedOrders > 0) {
        const completedTotal = orders
            .filter(o => o.status === 'delivered')
            .reduce((acc, order) => acc + (order.pricing?.total || order.totalAmount || 0), 0);
        stats.averageOrderValue = completedTotal / stats.completedOrders;
    } else {
        stats.averageOrderValue = 0;
    }

    res.status(200).json({
        success: true,
        data: stats
    });
});

// @desc    Deactivate user account
// @route   PUT /api/users/deactivate
// @access  Private
export const deactivateAccount = asyncHandler(async (req, res) => {
    // Check for pending orders
    const pendingOrders = await Order.find({
        user: req.user.id,
        status: { $in: ['pending', 'confirmed', 'preparing', 'on_the_way'] }
    });

    if (pendingOrders.length > 0) {
        res.status(400);
        throw new Error(`Cannot deactivate. You have ${pendingOrders.length} pending order(s).`);
    }

    await User.findByIdAndUpdate(req.user.id, { isActive: false });

    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });

    res.status(200).json({
        success: true,
        message: 'Account deactivated successfully'
    });
});