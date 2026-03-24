// controllers/bannerController.js
import Banner from '../models/Banner.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';

// @desc    Get all active banners
// @route   GET /api/banners
// @access  Public
export const getBanners = asyncHandler(async (req, res) => {
    const { location } = req.query;
    
    const filter = { isActive: true };
    
    // Filter by display location if provided
    if (location) {
        filter.$or = [
            { displayLocation: location },
            { displayLocation: 'all' }
        ];
    }
    
    // Get current date to filter by date range
    const now = new Date();
    
    const banners = await Banner.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();
    
    // Filter banners by date range
    const activeBanners = banners.filter(banner => {
        if (banner.startDate && now < new Date(banner.startDate)) return false;
        if (banner.endDate && now > new Date(banner.endDate)) return false;
        return true;
    });

    res.status(200).json({
        success: true,
        count: activeBanners.length,
        data: activeBanners
    });
});

// @desc    Get all banners (Admin)
// @route   GET /api/banners/all
// @access  Private/Admin
export const getAllBanners = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, location, status } = req.query;
    
    const filter = {};
    
    if (location) {
        filter.displayLocation = location;
    }
    
    if (status !== undefined) {
        filter.isActive = status === 'active';
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const banners = await Banner.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email');
    
    const total = await Banner.countDocuments(filter);
    
    res.status(200).json({
        success: true,
        count: banners.length,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        },
        data: banners
    });
});

// @desc    Get single banner
// @route   GET /api/banners/:id
// @access  Public
export const getBanner = asyncHandler(async (req, res) => {
    const banner = await Banner.findById(req.params.id)
        .populate('createdBy', 'name email');

    if (!banner) {
        res.status(404);
        throw new Error('Banner not found');
    }

    res.status(200).json({
        success: true,
        data: banner
    });
});

// @desc    Create banner
// @route   POST /api/banners
// @access  Private/Admin
export const createBanner = asyncHandler(async (req, res) => {
    // Handle image upload from Cloudinary
    if (req.file) {
        req.body.image = req.file.path; // Cloudinary URL
    }

    // Add creator info
    req.body.createdBy = req.user._id;

    const banner = await Banner.create(req.body);

    res.status(201).json({
        success: true,
        message: 'Banner created successfully',
        data: banner
    });
});

// @desc    Update banner
// @route   PUT /api/banners/:id
// @access  Private/Admin
export const updateBanner = asyncHandler(async (req, res) => {
    let banner = await Banner.findById(req.params.id);

    if (!banner) {
        res.status(404);
        throw new Error('Banner not found');
    }

    // Handle image upload - Delete old image from Cloudinary
    if (req.file) {
        // Delete old image from Cloudinary if exists
        if (banner.image) {
            await deleteFromCloudinary(banner.image);
        }
        req.body.image = req.file.path; // New Cloudinary URL
    }

    banner = await Banner.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        success: true,
        message: 'Banner updated successfully',
        data: banner
    });
});

// @desc    Delete banner
// @route   DELETE /api/banners/:id
// @access  Private/Admin
export const deleteBanner = asyncHandler(async (req, res) => {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
        res.status(404);
        throw new Error('Banner not found');
    }

    // Delete image from Cloudinary
    if (banner.image) {
        await deleteFromCloudinary(banner.image);
    }

    await banner.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Banner deleted successfully'
    });
});

// @desc    Toggle banner status
// @route   PUT /api/banners/:id/toggle
// @access  Private/Admin
export const toggleBannerStatus = asyncHandler(async (req, res) => {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
        res.status(404);
        throw new Error('Banner not found');
    }

    banner.isActive = !banner.isActive;
    await banner.save();

    res.status(200).json({
        success: true,
        message: `Banner is now ${banner.isActive ? 'active' : 'inactive'}`,
        data: banner
    });
});

// @desc    Update banner sort order
// @route   PUT /api/banners/:id/sort
// @access  Private/Admin
export const updateBannerSort = asyncHandler(async (req, res) => {
    const { sortOrder } = req.body;
    
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
        res.status(404);
        throw new Error('Banner not found');
    }

    banner.sortOrder = sortOrder;
    await banner.save();

    res.status(200).json({
        success: true,
        message: 'Banner sort order updated',
        data: banner
    });
});

// @desc    Bulk update banner sort orders
// @route   PUT /api/banners/sort/bulk
// @access  Private/Admin
export const bulkUpdateBannerSort = asyncHandler(async (req, res) => {
    const { banners } = req.body; // Array of { id, sortOrder }
    
    if (!Array.isArray(banners)) {
        res.status(400);
        throw new Error('Banners must be an array');
    }

    const updatePromises = banners.map(({ id, sortOrder }) => 
        Banner.findByIdAndUpdate(id, { sortOrder }, { new: true })
    );

    await Promise.all(updatePromises);

    res.status(200).json({
        success: true,
        message: 'Banner sort orders updated successfully'
    });
});