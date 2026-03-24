// controllers/foodController.js
import Food from '../models/Food.js';
import Category from '../models/Category.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import APIFeatures from '../utils/apiFeatures.js';
import { 
    deleteFromCloudinary, 
    deleteMultipleFromCloudinary 
} from '../config/cloudinary.js';

// @desc    Get all foods
// @route   GET /api/foods
// @access  Public
export const getFoods = asyncHandler(async (req, res) => {
    const features = new APIFeatures(Food.find({ isAvailable: true }), req.query)
        .filter()
        .search(['name', 'description', 'tags'])
        .sort()
        .limitFields()
        .paginate();

    const foods = await features.query
        .populate('category', 'name slug')
        .populate('restaurant', 'name slug logo');

    const pagination = await features.getPaginationInfo(Food, { isAvailable: true });

    res.status(200).json({
        success: true,
        count: foods.length,
        pagination,
        data: foods
    });
});

// @desc    Get single food
// @route   GET /api/foods/:id
// @access  Public
export const getFood = asyncHandler(async (req, res) => {
    const food = await Food.findById(req.params.id)
        .populate('category', 'name slug')
        .populate('restaurant', 'name slug logo address phone');

    if (!food) {
        res.status(404);
        throw new Error('Food item not found');
    }

    res.status(200).json({
        success: true,
        data: food
    });
});

// @desc    Create food
// @route   POST /api/foods
// @access  Private/Restaurant/Admin
export const createFood = asyncHandler(async (req, res) => {
    // Check if category exists
    const category = await Category.findById(req.body.category);
    if (!category) {
        res.status(404);
        throw new Error('Category not found');
    }

    // Handle single image upload (Cloudinary URL)
    if (req.file) {
        req.body.mainImage = req.file.path; // Cloudinary URL saved directly
    }

    // Handle multiple images upload
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        req.body.images = req.files.map(file => file.path); // Array of Cloudinary URLs
    }

    const food = await Food.create(req.body);

    res.status(201).json({
        success: true,
        message: 'Food item created successfully',
        data: food
    });
});

// @desc    Update food
// @route   PUT /api/foods/:id
// @access  Private/Restaurant/Admin
export const updateFood = asyncHandler(async (req, res) => {
    let food = await Food.findById(req.params.id);

    if (!food) {
        res.status(404);
        throw new Error('Food item not found');
    }

    // Handle single image upload - Delete old image from Cloudinary
    if (req.file) {
        // Delete old image from Cloudinary if exists
        if (food.mainImage) {
            await deleteFromCloudinary(food.mainImage);
        }
        req.body.mainImage = req.file.path; // New Cloudinary URL
    }

    // Handle multiple images upload - Delete old images from Cloudinary
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        // Delete old images from Cloudinary if exists
        if (food.images && food.images.length > 0) {
            await deleteMultipleFromCloudinary(food.images);
        }
        req.body.images = req.files.map(file => file.path); // New Cloudinary URLs
    }

    food = await Food.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        success: true,
        message: 'Food item updated successfully',
        data: food
    });
});

// @desc    Delete food
// @route   DELETE /api/foods/:id
// @access  Private/Restaurant/Admin
export const deleteFood = asyncHandler(async (req, res) => {
    const food = await Food.findById(req.params.id);

    if (!food) {
        res.status(404);
        throw new Error('Food item not found');
    }

    // Delete images from Cloudinary
    if (food.mainImage) {
        await deleteFromCloudinary(food.mainImage);
    }
    if (food.images && food.images.length > 0) {
        await deleteMultipleFromCloudinary(food.images);
    }

    await food.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Food item deleted successfully'
    });
});

// @desc    Get foods by category
// @route   GET /api/foods/category/:categoryId
// @access  Public
export const getFoodsByCategory = asyncHandler(async (req, res) => {
    const features = new APIFeatures(
        Food.find({ category: req.params.categoryId, isAvailable: true }),
        req.query
    )
        .filter()
        .sort()
        .paginate();

    const foods = await features.query
        .populate('category', 'name slug')
        .populate('restaurant', 'name slug logo');

    res.status(200).json({
        success: true,
        count: foods.length,
        data: foods
    });
});

// @desc    Get foods by restaurant
// @route   GET /api/foods/restaurant/:restaurantId
// @access  Public
export const getFoodsByRestaurant = asyncHandler(async (req, res) => {
    const features = new APIFeatures(
        Food.find({ restaurant: req.params.restaurantId, isAvailable: true }),
        req.query
    )
        .filter()
        .search(['name', 'description'])
        .sort()
        .paginate();

    const foods = await features.query.populate('category', 'name slug');

    res.status(200).json({
        success: true,
        count: foods.length,
        data: foods
    });
});

// @desc    Get featured foods
// @route   GET /api/foods/featured
// @access  Public
export const getFeaturedFoods = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;

    const foods = await Food.find({ isFeatured: true, isAvailable: true })
        .limit(limit)
        .populate('category', 'name slug')
        .populate('restaurant', 'name slug logo');

    res.status(200).json({
        success: true,
        count: foods.length,
        data: foods
    });
});

// @desc    Get popular foods
// @route   GET /api/foods/popular
// @access  Public
export const getPopularFoods = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;

    const foods = await Food.find({ isAvailable: true })
        .sort({ orderCount: -1, 'ratings.average': -1 })
        .limit(limit)
        .populate('category', 'name slug')
        .populate('restaurant', 'name slug logo');

    res.status(200).json({
        success: true,
        count: foods.length,
        data: foods
    });
});

// @desc    Search foods
// @route   GET /api/foods/search
// @access  Public
export const searchFoods = asyncHandler(async (req, res) => {
    const { q, category, minPrice, maxPrice, isVeg, rating } = req.query;

    const filter = { isAvailable: true };

    if (q) {
        filter.$or = [
            { name: { $regex: q, $options: 'i' } },
            { description: { $regex: q, $options: 'i' } },
            { tags: { $in: [new RegExp(q, 'i')] } }
        ];
    }

    if (category) {
        filter.category = category;
    }

    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = parseFloat(minPrice);
        if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    if (isVeg !== undefined) {
        filter.isVeg = isVeg === 'true';
    }

    if (rating) {
        filter['ratings.average'] = { $gte: parseFloat(rating) };
    }

    const features = new APIFeatures(Food.find(filter), req.query)
        .sort()
        .paginate();

    const foods = await features.query
        .populate('category', 'name slug')
        .populate('restaurant', 'name slug logo');

    const pagination = await features.getPaginationInfo(Food, filter);

    res.status(200).json({
        success: true,
        count: foods.length,
        pagination,
        data: foods
    });
});

// @desc    Toggle food availability
// @route   PUT /api/foods/:id/availability
// @access  Private/Restaurant/Admin
export const toggleAvailability = asyncHandler(async (req, res) => {
    const food = await Food.findById(req.params.id);

    if (!food) {
        res.status(404);
        throw new Error('Food item not found');
    }

    food.isAvailable = !food.isAvailable;
    await food.save();

    res.status(200).json({
        success: true,
        message: `Food item is now ${food.isAvailable ? 'available' : 'unavailable'}`,
        data: food
    });
});

// @desc    Get all categories
// @route   GET /api/foods/categories
// @access  Public
export const getCategories = asyncHandler(async (req, res) => {
    const categories = await Category.find({ isActive: true })
        .sort('sortOrder')
        .populate('subcategories');

    res.status(200).json({
        success: true,
        count: categories.length,
        data: categories
    });
});

// @desc    Create category
// @route   POST /api/foods/categories
// @access  Private/Admin
export const createCategory = asyncHandler(async (req, res) => {
    if (req.file) {
        req.body.image = req.file.path; // Cloudinary URL
    }

    const category = await Category.create(req.body);

    res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: category
    });
});

// @desc    Update category
// @route   PUT /api/foods/categories/:id
// @access  Private/Admin
export const updateCategory = asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
        res.status(404);
        throw new Error('Category not found');
    }

    if (req.file) {
        // Delete old image from Cloudinary
        if (category.image) {
            await deleteFromCloudinary(category.image);
        }
        req.body.image = req.file.path; // New Cloudinary URL
    }

    const updatedCategory = await Category.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        data: updatedCategory
    });
});

// @desc    Delete category
// @route   DELETE /api/foods/categories/:id
// @access  Private/Admin
export const deleteCategory = asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);

    if (!category) {
        res.status(404);
        throw new Error('Category not found');
    }

    const foodsCount = await Food.countDocuments({ category: req.params.id });
    if (foodsCount > 0) {
        res.status(400);
        throw new Error('Cannot delete category with existing food items');
    }

    // Delete category image from Cloudinary
    if (category.image) {
        await deleteFromCloudinary(category.image);
    }

    await category.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Category deleted successfully'
    });
});

// @desc    Remove specific image from food
// @route   DELETE /api/foods/:id/image
// @access  Private/Restaurant/Admin
export const removeImage = asyncHandler(async (req, res) => {
    const { imageUrl, imageType } = req.body; // imageType: 'main' or 'gallery'
    
    const food = await Food.findById(req.params.id);

    if (!food) {
        res.status(404);
        throw new Error('Food item not found');
    }

    if (imageType === 'main') {
        await deleteFromCloudinary(food.mainImage);
        food.mainImage = null;
    } else if (imageType === 'gallery' && imageUrl) {
        await deleteFromCloudinary(imageUrl);
        food.images = food.images.filter(img => img !== imageUrl);
    }

    await food.save();

    res.status(200).json({
        success: true,
        message: 'Image removed successfully',
        data: food
    });
});