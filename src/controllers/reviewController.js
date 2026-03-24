import Review from '../models/Review.js';
import Order from '../models/Order.js';
import Restaurant from '../models/Restaurant.js';
import Food from '../models/Food.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import APIFeatures from '../utils/apiFeatures.js';

// @desc    Get all reviews
// @route   GET /api/reviews
// @access  Public
export const getReviews = asyncHandler(async (req, res) => {
    const features = new APIFeatures(Review.find({ isVisible: true }), req.query)
        .filter()
        .sort()
        .paginate();

    const reviews = await features.query
        .populate('user', 'name avatar')
        .populate('restaurant', 'name logo')
        .populate('food', 'name mainImage');

    const pagination = await features.getPaginationInfo(Review, { isVisible: true });

    res.status(200).json({
        success: true,
        count: reviews.length,
        pagination,
        data: reviews
    });
});

// @desc    Get single review
// @route   GET /api/reviews/:id
// @access  Public
export const getReview = asyncHandler(async (req, res) => {
    const review = await Review.findById(req.params.id)
        .populate('user', 'name avatar')
        .populate('restaurant', 'name logo')
        .populate('order');

    if (!review) {
        res.status(404);
        throw new Error('Review not found');
    }

    res.status(200).json({
        success: true,
        data: review
    });
});

// @desc    Create review
// @route   POST /api/reviews
// @access  Private
export const createReview = asyncHandler(async (req, res) => {
    const { orderId, restaurantId, foodId, rating, ratings, title, comment, images } = req.body;

    // Verify order if provided
    if (orderId) {
        const order = await Order.findById(orderId);
        if (!order) {
            res.status(404);
            throw new Error('Order not found');
        }

        if (order.user.toString() !== req.user.id) {
            res.status(403);
            throw new Error('Not authorized to review this order');
        }

        if (order.status !== 'delivered') {
            res.status(400);
            throw new Error('Can only review delivered orders');
        }

        // Check if already reviewed
        const existingReview = await Review.findOne({ order: orderId, user: req.user.id });
        if (existingReview) {
            res.status(400);
            throw new Error('You have already reviewed this order');
        }
    }

    const reviewData = {
        user: req.user.id,
        rating,
        comment,
        title,
        images: images || []
    };

    if (orderId) reviewData.order = orderId;
    if (restaurantId) reviewData.restaurant = restaurantId;
    if (foodId) reviewData.food = foodId;
    if (ratings) reviewData.ratings = ratings;

    // Handle image uploads
    if (req.files && req.files.length > 0) {
        reviewData.images = req.files.map(file => file.filename);
    }

    const review = await Review.create(reviewData);

    // Populate review
    await review.populate('user', 'name avatar');

    res.status(201).json({
        success: true,
        message: 'Review submitted successfully',
        data: review
    });
});

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
export const updateReview = asyncHandler(async (req, res) => {
    let review = await Review.findById(req.params.id);

    if (!review) {
        res.status(404);
        throw new Error('Review not found');
    }

    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized to update this review');
    }

    const { rating, ratings, title, comment } = req.body;

    review = await Review.findByIdAndUpdate(
        req.params.id,
        { rating, ratings, title, comment },
        { new: true, runValidators: true }
    ).populate('user', 'name avatar');

    res.status(200).json({
        success: true,
        message: 'Review updated successfully',
        data: review
    });
});

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
export const deleteReview = asyncHandler(async (req, res) => {
    const review = await Review.findById(req.params.id);

    if (!review) {
        res.status(404);
        throw new Error('Review not found');
    }

    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized to delete this review');
    }

    await review.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Review deleted successfully'
    });
});

// @desc    Get restaurant reviews
// @route   GET /api/reviews/restaurant/:restaurantId
// @access  Public
export const getRestaurantReviews = asyncHandler(async (req, res) => {
    const features = new APIFeatures(
        Review.find({ restaurant: req.params.restaurantId, isVisible: true }),
        req.query
    )
        .sort()
        .paginate();

    const reviews = await features.query.populate('user', 'name avatar');

    // Get rating summary
    const ratingStats = await Review.aggregate([
        { $match: { restaurant: req.params.restaurantId, isVisible: true } },
        {
            $group: {
                _id: null,
                avgRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
                rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
                rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
                rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
                rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
                rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
            }
        }
    ]);

    const pagination = await features.getPaginationInfo(
        Review,
        { restaurant: req.params.restaurantId, isVisible: true }
    );

    res.status(200).json({
        success: true,
        count: reviews.length,
        ratingStats: ratingStats[0] || {},
        pagination,
        data: reviews
    });
});

// @desc    Get food reviews
// @route   GET /api/reviews/food/:foodId
// @access  Public
export const getFoodReviews = asyncHandler(async (req, res) => {
    const features = new APIFeatures(
        Review.find({ food: req.params.foodId, isVisible: true }),
        req.query
    )
        .sort()
        .paginate();

    const reviews = await features.query.populate('user', 'name avatar');

    res.status(200).json({
        success: true,
        count: reviews.length,
        data: reviews
    });
});

// @desc    Like review
// @route   PUT /api/reviews/:id/like
// @access  Private
export const likeReview = asyncHandler(async (req, res) => {
    const review = await Review.findById(req.params.id);

    if (!review) {
        res.status(404);
        throw new Error('Review not found');
    }

    const likeIndex = review.likes.indexOf(req.user.id);

    if (likeIndex > -1) {
        // Unlike
        review.likes.splice(likeIndex, 1);
        review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
        // Like
        review.likes.push(req.user.id);
        review.helpfulCount += 1;
    }

    await review.save();

    res.status(200).json({
        success: true,
        data: {
            liked: likeIndex === -1,
            helpfulCount: review.helpfulCount
        }
    });
});

// @desc    Reply to review (Restaurant owner)
// @route   POST /api/reviews/:id/reply
// @access  Private/Restaurant
export const replyToReview = asyncHandler(async (req, res) => {
    const { comment } = req.body;

    const review = await Review.findById(req.params.id).populate('restaurant');

    if (!review) {
        res.status(404);
        throw new Error('Review not found');
    }

    // Check if user owns the restaurant
    if (review.restaurant.owner.toString() !== req.user.id && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized to reply to this review');
    }

    review.reply = {
        comment,
        repliedAt: new Date(),
        repliedBy: req.user.id
    };

    await review.save();

    res.status(200).json({
        success: true,
        message: 'Reply added successfully',
        data: review
    });
});

// @desc    Get my reviews
// @route   GET /api/reviews/my-reviews
// @access  Private
export const getMyReviews = asyncHandler(async (req, res) => {
    const features = new APIFeatures(Review.find({ user: req.user.id }), req.query)
        .sort()
        .paginate();

    const reviews = await features.query
        .populate('restaurant', 'name logo')
        .populate('food', 'name mainImage');

    const pagination = await features.getPaginationInfo(Review, { user: req.user.id });

    res.status(200).json({
        success: true,
        count: reviews.length,
        pagination,
        data: reviews
    });
});