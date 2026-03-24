// routes/foodRoutes.js
import express from 'express';
import {
    getFoods,
    getFood,
    createFood,
    updateFood,
    deleteFood,
    getFoodsByCategory,
    getFoodsByRestaurant,
    getFeaturedFoods,
    getPopularFoods,
    searchFoods,
    toggleAvailability,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    removeImage
} from '../controllers/foodController.js';
import { protect, authorize, optionalAuth } from '../middleware/authMiddleware.js';
import { uploadSingle, uploadMultiple } from '../middleware/uploadMiddleware.js';
import { foodValidation, idValidation, validate } from '../middleware/validateMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getFoods);
router.get('/featured', getFeaturedFoods);
router.get('/popular', getPopularFoods);
router.get('/search', searchFoods);
router.get('/categories', getCategories);
router.get('/category/:categoryId', getFoodsByCategory);
router.get('/restaurant/:restaurantId', getFoodsByRestaurant);
router.get('/:id', idValidation, validate, getFood);

// Protected routes
router.use(protect);

// Restaurant/Admin routes
router.post(
    '/', 
    authorize('restaurant', 'admin'), 
    uploadSingle('mainImage'),  
    validate, 
    createFood
);

router.post(
    '/with-gallery', 
    authorize('restaurant', 'admin'), 
    uploadMultiple('foodImages', 5),  
    validate, 
    createFood
);

router.put(
    '/:id', 
    authorize('restaurant', 'admin'), 
    uploadSingle('mainImage'),  
    validate, 
    updateFood
);

router.delete(
    '/:id', 
    authorize('restaurant', 'admin'), 
    idValidation, 
    validate, 
    deleteFood
);

router.put(
    '/:id/availability', 
    authorize('restaurant', 'admin'), 
    toggleAvailability
);

router.delete(
    '/:id/image', 
    authorize('restaurant', 'admin'), 
    removeImage
);

// Admin only - Category management
router.post('/categories', authorize('restaurant','admin'), uploadSingle('image'), createCategory);
router.put('/categories/:id', authorize('restaurant','admin'), uploadSingle('image'), updateCategory);
router.delete('/categories/:id', authorize('restaurant','admin'), deleteCategory);

export default router;