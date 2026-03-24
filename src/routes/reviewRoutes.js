import express from 'express';
import {
    getReviews,
    getReview,
    createReview,
    updateReview,
    deleteReview,
    getRestaurantReviews,
    getFoodReviews,
    likeReview,
    replyToReview,
    getMyReviews
} from '../controllers/reviewController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { uploadMultiple } from '../middleware/uploadMiddleware.js';
import { reviewValidation, idValidation, validate } from '../middleware/validateMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getReviews);
router.get('/restaurant/:restaurantId', getRestaurantReviews);
router.get('/food/:foodId', getFoodReviews);
router.get('/:id', idValidation, validate, getReview);

// Protected routes
router.use(protect);

router.get('/user/my-reviews', getMyReviews);
router.post('/', uploadMultiple('images', 5), reviewValidation.create, validate, createReview);
router.put('/:id', idValidation, validate, updateReview);
router.delete('/:id', idValidation, validate, deleteReview);
router.put('/:id/like', idValidation, validate, likeReview);
router.post('/:id/reply', authorize('restaurant', 'admin'), idValidation, validate, replyToReview);

export default router;