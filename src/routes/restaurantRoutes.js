import express from 'express';
import {
    getRestaurants,
    getRestaurant,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant,
    getNearbyRestaurants,
    getPopularRestaurants,
    getFeaturedRestaurants,
    searchRestaurants,
    toggleStatus,
    getRestaurantStats,
    getRestaurantMenu,
    getMyRestaurant
} from '../controllers/restaurantController.js';
import { protect, authorize, optionalAuth } from '../middleware/authMiddleware.js';
import { uploadFields } from '../middleware/uploadMiddleware.js';
import { idValidation, validate } from '../middleware/validateMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getRestaurants);
router.get('/nearby', getNearbyRestaurants);
router.get('/popular', getPopularRestaurants);
router.get('/featured', getFeaturedRestaurants);
router.get('/search', searchRestaurants);
router.get('/:id', idValidation, validate, getRestaurant);
router.get('/:id/menu', idValidation, validate, getRestaurantMenu);

// Protected routes
router.use(protect);

// Restaurant owner routes
router.get('/owner/my-restaurant', authorize('restaurant'), getMyRestaurant);
router.put('/:id/toggle-status', authorize('restaurant', 'admin'), toggleStatus);
router.get('/:id/stats', authorize('restaurant', 'admin'), getRestaurantStats);

// Create and update with file uploads
const uploadConfig = uploadFields([
    { name: 'logo', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
    { name: 'images', maxCount: 10 }
]);

router.post('/', authorize('restaurant', 'admin'), uploadConfig, createRestaurant);
router.put('/:id', authorize('restaurant', 'admin'), uploadConfig, updateRestaurant);
router.delete('/:id', authorize('admin'), idValidation, validate, deleteRestaurant);

export default router;