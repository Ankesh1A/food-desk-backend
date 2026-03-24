// routes/bannerRoutes.js
import express from 'express';
import {
    getBanners,
    getAllBanners,
    getBanner,
    createBanner,
    updateBanner,
    deleteBanner,
    toggleBannerStatus,
    updateBannerSort,
    bulkUpdateBannerSort
} from '../controllers/bannerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { uploadSingle } from '../middleware/uploadMiddleware.js';

const router = express.Router();


// Protected routes - Admin only
router.get('/admin/all', protect, authorize('admin'), getAllBanners);
router.put('/sort/bulk', protect, authorize('admin'), bulkUpdateBannerSort);

// Public routes
router.get('/', getBanners); // Get active banners for public

// Protected routes - Admin only (with upload)
router.post('/', protect, authorize('admin'), uploadSingle('image'), createBanner);
    
// Routes with :id parameter - MUST come after specific routes
router.get('/:id', getBanner); // Get single banner
router.put('/:id', protect, authorize('admin'), uploadSingle('image'), updateBanner);
router.delete('/:id', protect, authorize('admin'), deleteBanner);
router.put('/:id/toggle', protect, authorize('admin'), toggleBannerStatus);
router.put('/:id/sort', protect, authorize('admin'), updateBannerSort);

export default router;