import Restaurant from '../models/Restaurant.js';
import Food from '../models/Food.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import APIFeatures from '../utils/apiFeatures.js';
import { calculateDistance } from '../utils/helpers.js';

// @desc    Get all restaurants
// @route   GET /api/restaurants
// @access  Public
export const getRestaurants = asyncHandler(async (req, res) => {
    const features = new APIFeatures(Restaurant.find({ isActive: true }), req.query)
        .filter()
        .search(['name', 'cuisine', 'description'])
        .sort()
        .limitFields()
        .paginate();

    const restaurants = await features.query;
    const pagination = await features.getPaginationInfo(Restaurant, { isActive: true });

    res.status(200).json({
        success: true,
        count: restaurants.length,
        pagination,
        data: restaurants
    });
});


export const getRestaurant = asyncHandler(async (req, res) => {
    const restaurant = await Restaurant.findById(req.params.id)
        .populate('categories', 'name slug')
        .populate('owner', 'name email');

    if (!restaurant) {
        res.status(404);
        throw new Error('Restaurant not found');
    }

    // Get menu items
    const menuItems = await Food.find({ 
        restaurant: req.params.id, 
        isAvailable: true 
    }).populate('category', 'name');

    // Get reviews
    const reviews = await Review.find({ 
        restaurant: req.params.id, 
        isVisible: true 
    })
        .limit(10)
        .populate('user', 'name avatar')
        .sort('-createdAt');

    res.status(200).json({
        success: true,
        data: {
            ...restaurant.toObject(),
            menuItems,
            reviews
        }
    });
});


export const createRestaurant = asyncHandler(async (req, res) => {
    // Set owner to current user if not admin
    if (req.user.role !== 'admin') {
        req.body.owner = req.user.id;
    }

    // Handle file uploads
    if (req.files) {
        if (req.files.logo) {
            req.body.logo = req.files.logo[0].filename;
        }
        if (req.files.coverImage) {
            req.body.coverImage = req.files.coverImage[0].filename;
        }
        if (req.files.images) {
            req.body.images = req.files.images.map(file => file.filename);
        }
    }

    const restaurant = await Restaurant.create(req.body);

    // Update user role to restaurant
    if (req.user.role === 'user') {
        req.user.role = 'restaurant';
        await req.user.save();
    }

    res.status(201).json({
        success: true,
        message: 'Restaurant created successfully',
        data: restaurant
    });
});

// @desc    Update restaurant
// @route   PUT /api/restaurants/:id
// @access  Private/Restaurant Owner/Admin
export const updateRestaurant = asyncHandler(async (req, res) => {
    let restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
        res.status(404);
        throw new Error('Restaurant not found');
    }

    // Check ownership
    if (restaurant.owner.toString() !== req.user.id && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized to update this restaurant');
    }

    // Handle file uploads
    if (req.files) {
        if (req.files.logo) {
            req.body.logo = req.files.logo[0].filename;
        }
        if (req.files.coverImage) {
            req.body.coverImage = req.files.coverImage[0].filename;
        }
        if (req.files.images) {
            req.body.images = req.files.images.map(file => file.filename);
        }
    }

    restaurant = await Restaurant.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        success: true,
        message: 'Restaurant updated successfully',
        data: restaurant
    });
});

// @desc    Delete restaurant
// @route   DELETE /api/restaurants/:id
// @access  Private/Admin
export const deleteRestaurant = asyncHandler(async (req, res) => {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
        res.status(404);
        throw new Error('Restaurant not found');
    }

    // Delete all associated foods
    await Food.deleteMany({ restaurant: req.params.id });

    await restaurant.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Restaurant deleted successfully'
    });
});

// @desc    Get nearby restaurants
// @route   GET /api/restaurants/nearby
// @access  Public
export const getNearbyRestaurants = asyncHandler(async (req, res) => {
    const { lat, lng, radius = 10 } = req.query; // radius in km

    if (!lat || !lng) {
        res.status(400);
        throw new Error('Please provide latitude and longitude');
    }

    const restaurants = await Restaurant.find({ 
        isActive: true,
        'address.coordinates': { $exists: true }
    });

    // Filter by distance
    const nearbyRestaurants = restaurants.filter(restaurant => {
        if (!restaurant.address?.coordinates?.lat || !restaurant.address?.coordinates?.lng) {
            return false;
        }
        const distance = calculateDistance(
            parseFloat(lat),
            parseFloat(lng),
            restaurant.address.coordinates.lat,
            restaurant.address.coordinates.lng
        );
        restaurant._doc.distance = Math.round(distance * 10) / 10;
        return distance <= radius;
    });

    // Sort by distance
    nearbyRestaurants.sort((a, b) => a._doc.distance - b._doc.distance);

    res.status(200).json({
        success: true,
        count: nearbyRestaurants.length,
        data: nearbyRestaurants
    });
});

// @desc    Get popular restaurants
// @route   GET /api/restaurants/popular
// @access  Public
export const getPopularRestaurants = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;

    const restaurants = await Restaurant.find({ isActive: true })
        .sort({ 'ratings.average': -1, totalOrders: -1 })
        .limit(limit);

    res.status(200).json({
        success: true,
        count: restaurants.length,
        data: restaurants
    });
});

// @desc    Get featured restaurants
// @route   GET /api/restaurants/featured
// @access  Public
export const getFeaturedRestaurants = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;

    const restaurants = await Restaurant.find({ 
        isActive: true, 
        isVerified: true 
    })
        .sort({ 'ratings.average': -1 })
        .limit(limit);

    res.status(200).json({
        success: true,
        count: restaurants.length,
        data: restaurants
    });
});

// @desc    Search restaurants
// @route   GET /api/restaurants/search
// @access  Public
export const searchRestaurants = asyncHandler(async (req, res) => {
    const { q, cuisine, priceRange, rating, isOpen } = req.query;

    const filter = { isActive: true };

    if (q) {
        filter.$or = [
            { name: { $regex: q, $options: 'i' } },
            { cuisine: { $in: [new RegExp(q, 'i')] } },
            { description: { $regex: q, $options: 'i' } }
        ];
    }

    if (cuisine) {
        filter.cuisine = { $in: cuisine.split(',') };
    }

    if (priceRange) {
        filter.priceRange = priceRange;
    }

    if (rating) {
        filter['ratings.average'] = { $gte: parseFloat(rating) };
    }

    if (isOpen !== undefined) {
        filter.isOpen = isOpen === 'true';
    }

    const features = new APIFeatures(Restaurant.find(filter), req.query)
        .sort()
        .paginate();

    const restaurants = await features.query;
    const pagination = await features.getPaginationInfo(Restaurant, filter);

    res.status(200).json({
        success: true,
        count: restaurants.length,
        pagination,
        data: restaurants
    });
});

// @desc    Toggle restaurant status (open/closed)
// @route   PUT /api/restaurants/:id/toggle-status
// @access  Private/Restaurant Owner
export const toggleStatus = asyncHandler(async (req, res) => {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
        res.status(404);
        throw new Error('Restaurant not found');
    }

    if (restaurant.owner.toString() !== req.user.id && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized');
    }

    restaurant.isOpen = !restaurant.isOpen;
    await restaurant.save();

    res.status(200).json({
        success: true,
        message: `Restaurant is now ${restaurant.isOpen ? 'open' : 'closed'}`,
        data: restaurant
    });
});

// @desc    Get restaurant statistics
// @route   GET /api/restaurants/:id/stats
// @access  Private/Restaurant Owner
export const getRestaurantStats = asyncHandler(async (req, res) => {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
        res.status(404);
        throw new Error('Restaurant not found');
    }

    if (restaurant.owner.toString() !== req.user.id && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized');
    }

    // Get order statistics
    const orders = await Order.find({ restaurant: req.params.id });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = orders.filter(o => new Date(o.createdAt) >= today);

    const stats = {
        totalOrders: orders.length,
        totalRevenue: orders.reduce((acc, o) => acc + o.pricing.total, 0),
        todayOrders: todayOrders.length,
        todayRevenue: todayOrders.reduce((acc, o) => acc + o.pricing.total, 0),
        pendingOrders: orders.filter(o => o.status === 'pending').length,
        completedOrders: orders.filter(o => o.status === 'delivered').length,
        cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
        averageRating: restaurant.ratings.average,
        totalReviews: restaurant.ratings.count,
        menuItems: await Food.countDocuments({ restaurant: req.params.id }),
        activeMenuItems: await Food.countDocuments({ restaurant: req.params.id, isAvailable: true })
    };

    res.status(200).json({
        success: true,
        data: stats
    });
});

// @desc    Get restaurant menu
// @route   GET /api/restaurants/:id/menu
// @access  Public
export const getRestaurantMenu = asyncHandler(async (req, res) => {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
        res.status(404);
        throw new Error('Restaurant not found');
    }

    const { category, isVeg } = req.query;
    const filter = { restaurant: req.params.id, isAvailable: true };

    if (category) {
        filter.category = category;
    }

    if (isVeg !== undefined) {
        filter.isVeg = isVeg === 'true';
    }

    const menuItems = await Food.find(filter)
        .populate('category', 'name')
        .sort('category name');

    // Group by category
    const menuByCategory = {};
    menuItems.forEach(item => {
        const categoryName = item.category?.name || 'Uncategorized';
        if (!menuByCategory[categoryName]) {
            menuByCategory[categoryName] = [];
        }
        menuByCategory[categoryName].push(item);
    });

    res.status(200).json({
        success: true,
        count: menuItems.length,
        data: menuByCategory
    });
});

// @desc    Get my restaurant (for restaurant owners)
// @route   GET /api/restaurants/my-restaurant
// @access  Private/Restaurant
export const getMyRestaurant = asyncHandler(async (req, res) => {
    const restaurant = await Restaurant.findOne({ owner: req.user.id });

    if (!restaurant) {
        res.status(404);
        throw new Error('You do not have a registered restaurant');
    }

    res.status(200).json({
        success: true,
        data: restaurant
    });
});