

// controllers/searchController.js
import Food from '../models/Food.js';
import Restaurant from '../models/Restaurant.js';
import Category from '../models/Category.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

// @desc    Global search for foods, restaurants, and categories
// @route   GET /api/search
// @access  Public
export const globalSearch = asyncHandler(async (req, res) => {
    const { 
        q, // search query
        type, // 'food', 'restaurant', 'category', 'all'
        category,
        minPrice,
        maxPrice,
        isVeg,
        rating,
        page = 1,
        limit = 20,
        sortBy = 'relevance' // 'relevance', 'price_low', 'price_high', 'rating', 'popular'
    } = req.query;

    if (!q || q.trim().length < 2) {
        res.status(400);
        throw new Error('Search query must be at least 2 characters');
    }

    const searchQuery = q.trim();
    const results = {};

    // Search Foods
    if (!type || type === 'food' || type === 'all') {
        const foodFilter = { isAvailable: true };

        // Text search with relevance scoring
        foodFilter.$or = [
            { name: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } },
            { tags: { $in: [new RegExp(searchQuery, 'i')] } }
        ];

        // Additional filters
        if (category) {
            foodFilter.category = category;
        }

        if (minPrice || maxPrice) {
            foodFilter.price = {};
            if (minPrice) foodFilter.price.$gte = parseFloat(minPrice);
            if (maxPrice) foodFilter.price.$lte = parseFloat(maxPrice);
        }

        if (isVeg !== undefined) {
            foodFilter.isVeg = isVeg === 'true';
        }

        if (rating) {
            foodFilter['ratings.average'] = { $gte: parseFloat(rating) };
        }

        // Build sort criteria
        let sortCriteria = {};
        switch (sortBy) {
            case 'price_low':
                sortCriteria = { price: 1 };
                break;
            case 'price_high':
                sortCriteria = { price: -1 };
                break;
            case 'rating':
                sortCriteria = { 'ratings.average': -1, 'ratings.count': -1 };
                break;
            case 'popular':
                sortCriteria = { orderCount: -1, 'ratings.average': -1 };
                break;
            default: // relevance
                sortCriteria = { orderCount: -1, 'ratings.average': -1 };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Fetch foods with proper population and null handling
        let foods = await Food.find(foodFilter)
            .sort(sortCriteria)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('category', 'name slug icon image')
            .lean();

        // Try to populate restaurant if field exists, but don't fail if it doesn't
        try {
            foods = await Food.populate(foods, {
                path: 'restaurant',
                select: 'name slug logo address ratings'
            });
        } catch (error) {
            console.log('Restaurant population skipped (field may not exist):', error.message);
        }

        // Clean up null/undefined values
        foods = foods.map(food => ({
            _id: food._id,
            name: food.name || '',
            description: food.description || '',
            price: food.price || 0,
            discountPrice: food.discountPrice || 0,
            mainImage: food.mainImage || food.image || '',
            images: food.images || [],
            isVeg: food.isVeg || false,
            isAvailable: food.isAvailable !== false,
            isFeatured: food.isFeatured || false,
            tags: food.tags || [],
            ingredients: food.ingredients || [],
            preparationTime: food.preparationTime || 0,
            ratings: {
                average: food.ratings?.average || 0,
                count: food.ratings?.count || 0
            },
            orderCount: food.orderCount || 0,
            category: food.category ? {
                _id: food.category._id,
                name: food.category.name || '',
                slug: food.category.slug || '',
                icon: food.category.icon || '',
                image: food.category.image || ''
            } : null,
            restaurant: food.restaurant ? {
                _id: food.restaurant._id,
                name: food.restaurant.name || '',
                slug: food.restaurant.slug || '',
                logo: food.restaurant.logo || '',
                address: food.restaurant.address || {},
                ratings: food.restaurant.ratings || { average: 0, count: 0 }
            } : null,
            createdAt: food.createdAt,
            updatedAt: food.updatedAt
        }));

        const totalFoods = await Food.countDocuments(foodFilter);

        results.foods = {
            data: foods,
            count: foods.length,
            total: totalFoods,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalFoods / parseInt(limit))
            }
        };
    }

    // Search Restaurants
    if (!type || type === 'restaurant' || type === 'all') {
        const restaurantFilter = { isActive: true };

        restaurantFilter.$or = [
            { name: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } },
            { cuisines: { $in: [new RegExp(searchQuery, 'i')] } },
            { 'address.city': { $regex: searchQuery, $options: 'i' } },
            { 'address.area': { $regex: searchQuery, $options: 'i' } }
        ];

        let restaurants = await Restaurant.find(restaurantFilter)
            .sort({ 'ratings.average': -1, 'ratings.count': -1 })
            .limit(type === 'restaurant' ? parseInt(limit) : 5)
            .select('name slug logo cuisines ratings address isOpen deliveryTime minOrder')
            .lean();

        // Clean up restaurant data
        restaurants = restaurants.map(restaurant => ({
            _id: restaurant._id,
            name: restaurant.name || '',
            slug: restaurant.slug || '',
            logo: restaurant.logo || '',
            cuisines: restaurant.cuisines || [],
            ratings: {
                average: restaurant.ratings?.average || 0,
                count: restaurant.ratings?.count || 0
            },
            address: restaurant.address || {},
            isOpen: restaurant.isOpen !== false,
            deliveryTime: restaurant.deliveryTime || 0,
            minOrder: restaurant.minOrder || 0
        }));

        results.restaurants = {
            data: restaurants,
            count: restaurants.length
        };
    }

    // Search Categories
    if (!type || type === 'category' || type === 'all') {
        let categories = await Category.find({
            isActive: true,
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } }
            ]
        })
            .sort({ sortOrder: 1 })
            .limit(type === 'category' ? parseInt(limit) : 5)
            .select('name slug icon image description')
            .lean();

        // Clean up category data
        categories = categories.map(category => ({
            _id: category._id,
            name: category.name || '',
            slug: category.slug || '',
            icon: category.icon || '',
            image: category.image || '',
            description: category.description || ''
        }));

        results.categories = {
            data: categories,
            count: categories.length
        };
    }

    res.status(200).json({
        success: true,
        query: searchQuery,
        results
    });
});

// @desc    Get search suggestions (autocomplete)
// @route   GET /api/search/suggestions
// @access  Public
export const getSearchSuggestions = asyncHandler(async (req, res) => {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
        return res.status(200).json({
            success: true,
            suggestions: []
        });
    }

    const searchQuery = q.trim();
    const suggestions = [];

    // Get food suggestions
    const foods = await Food.find({
        isAvailable: true,
        name: { $regex: searchQuery, $options: 'i' }
    })
        .select('name category')
        .populate('category', 'name')
        .limit(5)
        .lean();

    foods.forEach(food => {
        suggestions.push({
            type: 'food',
            text: food.name || '',
            category: food.category?.name || null
        });
    });

    // Get restaurant suggestions
    try {
        const restaurants = await Restaurant.find({
            isActive: true,
            name: { $regex: searchQuery, $options: 'i' }
        })
            .select('name')
            .limit(3)
            .lean();

        restaurants.forEach(restaurant => {
            suggestions.push({
                type: 'restaurant',
                text: restaurant.name || ''
            });
        });
    } catch (error) {
        console.log('Restaurant suggestions skipped:', error.message);
    }

    // Get category suggestions
    const categories = await Category.find({
        isActive: true,
        name: { $regex: searchQuery, $options: 'i' }
    })
        .select('name')
        .limit(3)
        .lean();

    categories.forEach(category => {
        suggestions.push({
            type: 'category',
            text: category.name || ''
        });
    });

    res.status(200).json({
        success: true,
        query: searchQuery,
        suggestions: suggestions.slice(0, 10) // Limit to 10 total suggestions
    });
});

// @desc    Get trending searches
// @route   GET /api/search/trending
// @access  Public
export const getTrendingSearches = asyncHandler(async (req, res) => {
    // Get most ordered foods as trending
    const trendingFoods = await Food.find({ isAvailable: true })
        .sort({ orderCount: -1 })
        .limit(5)
        .select('name')
        .lean();

    // Get popular categories
    const categories = await Category.find({ isActive: true })
        .sort({ sortOrder: 1 })
        .limit(5)
        .select('name')
        .lean();

    const trending = [
        ...trendingFoods.map(f => ({ type: 'food', text: f.name || '' })),
        ...categories.map(c => ({ type: 'category', text: c.name || '' }))
    ];

    res.status(200).json({
        success: true,
        trending: trending.filter(t => t.text).slice(0, 8) // Filter out empty and limit
    });
});

// @desc    Advanced food filters
// @route   GET /api/search/filters
// @access  Public
export const getSearchFilters = asyncHandler(async (req, res) => {
    // Get available categories
    const categories = await Category.find({ isActive: true })
        .select('name slug')
        .sort('sortOrder')
        .lean();

    // Clean categories
    const cleanCategories = categories.map(cat => ({
        _id: cat._id,
        name: cat.name || '',
        slug: cat.slug || ''
    }));

    // Get price range
    const priceRange = await Food.aggregate([
        { $match: { isAvailable: true } },
        {
            $group: {
                _id: null,
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' }
            }
        }
    ]);

    res.status(200).json({
        success: true,
        filters: {
            categories: cleanCategories,
            priceRange: priceRange[0] || { minPrice: 0, maxPrice: 1000 },
            dietaryOptions: [
                { value: 'all', label: 'All' },
                { value: 'veg', label: 'Vegetarian' },
                { value: 'non-veg', label: 'Non-Vegetarian' }
            ],
            ratings: [
                { value: 4.5, label: '4.5+ Stars' },
                { value: 4.0, label: '4.0+ Stars' },
                { value: 3.5, label: '3.5+ Stars' },
                { value: 3.0, label: '3.0+ Stars' }
            ],
            sortOptions: [
                { value: 'relevance', label: 'Most Relevant' },
                { value: 'popular', label: 'Most Popular' },
                { value: 'rating', label: 'Highest Rated' },
                { value: 'price_low', label: 'Price: Low to High' },
                { value: 'price_high', label: 'Price: High to Low' }
            ]
        }
    });
});