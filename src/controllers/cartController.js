import Cart from '../models/Cart.js';
import Food from '../models/Food.js';
import Restaurant from '../models/Restaurant.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
export const getCart = asyncHandler(async (req, res) => {
    let cart = await Cart.findOne({ user: req.user.id })
        .populate('items.food', 'name mainImage price discountPrice isAvailable')
        .populate('restaurant', 'name logo deliveryFee minimumOrder deliveryTime isOpen');

    if (!cart) {
        cart = await Cart.create({ user: req.user.id, items: [] });
    }

    res.status(200).json({
        success: true,
        data: cart
    });
});

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private
export const addToCart = asyncHandler(async (req, res) => {
    // FIXED: Accept both 'food' and 'foodId' from request body
    const { food: foodFromBody, foodId: foodIdFromBody, quantity = 1, addons, specialInstructions } = req.body;
    
    // Use whichever field is provided
    const foodId = foodFromBody || foodIdFromBody;
    
    if (!foodId) {
        res.status(400);
        throw new Error('Food ID is required');
    }

    console.log('Adding to cart - Food ID:', foodId);

    // Get food details
    const food = await Food.findById(foodId);
    if (!food) {
        res.status(404);
        throw new Error('Food item not found');
    }

    if (!food.isAvailable) {
        res.status(400);
        throw new Error('Food item is currently unavailable');
    }

    // Get or create cart
    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
        cart = await Cart.create({
            user: req.user.id,
            restaurant: food.restaurant,
            items: []
        });
    }

    // Check if cart has items from different restaurant
    if (cart.restaurant && cart.restaurant.toString() !== food.restaurant.toString() && cart.items.length > 0) {
        res.status(400);
        throw new Error('Cart already has items from a different restaurant. Clear cart first.');
    }

    // Set restaurant if not set
    if (!cart.restaurant) {
        cart.restaurant = food.restaurant;
    }

    // Calculate item price - FIXED: Use correct price logic
    const itemPrice = food.discountPrice && food.discountPrice > 0 && food.discountPrice < food.price 
        ? food.discountPrice 
        : food.price;

    let addonsTotal = 0;
    if (addons && addons.length > 0) {
        addons.forEach(addon => {
            addonsTotal += addon.price || 0;
        });
    }

    const itemTotal = (itemPrice + addonsTotal) * quantity;

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
        item => item.food.toString() === foodId && 
        JSON.stringify(item.addons) === JSON.stringify(addons)
    );

    if (existingItemIndex > -1) {
        // Update quantity
        cart.items[existingItemIndex].quantity += quantity;
        cart.items[existingItemIndex].total = 
            (cart.items[existingItemIndex].price + addonsTotal) * cart.items[existingItemIndex].quantity;
    } else {
        // Add new item
        cart.items.push({
            food: foodId,
            quantity,
            addons: addons || [],
            specialInstructions,
            price: itemPrice,
            total: itemTotal
        });
    }

    // Get restaurant delivery fee
    const restaurant = await Restaurant.findById(food.restaurant);
    if (restaurant) {
        cart.deliveryFee = restaurant.deliveryFee || 0;
    }

    await cart.save();

    // Populate cart before sending response
    await cart.populate('items.food', 'name mainImage price discountPrice');
    await cart.populate('restaurant', 'name logo deliveryFee minimumOrder deliveryTime');

    res.status(200).json({
        success: true,
        message: 'Item added to cart',
        data: cart
    });
});

// @desc    Update cart item quantity
// @route   PUT /api/cart/update/:itemId
// @access  Private
export const updateCartItem = asyncHandler(async (req, res) => {
    const { quantity } = req.body;

    if (quantity < 1) {
        res.status(400);
        throw new Error('Quantity must be at least 1');
    }

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
        res.status(404);
        throw new Error('Cart not found');
    }

    const itemIndex = cart.items.findIndex(
        item => item._id.toString() === req.params.itemId
    );

    if (itemIndex === -1) {
        res.status(404);
        throw new Error('Item not found in cart');
    }

    // Update quantity and total
    const addonsTotal = cart.items[itemIndex].addons.reduce((acc, addon) => acc + (addon.price || 0), 0);
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].total = (cart.items[itemIndex].price + addonsTotal) * quantity;

    await cart.save();

    await cart.populate('items.food', 'name mainImage price discountPrice');
    await cart.populate('restaurant', 'name logo deliveryFee minimumOrder deliveryTime');

    res.status(200).json({
        success: true,
        message: 'Cart updated',
        data: cart
    });
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/remove/:itemId
// @access  Private
export const removeFromCart = asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
        res.status(404);
        throw new Error('Cart not found');
    }

    const itemIndex = cart.items.findIndex(
        item => item._id.toString() === req.params.itemId
    );

    if (itemIndex === -1) {
        res.status(404);
        throw new Error('Item not found in cart');
    }

    cart.items.splice(itemIndex, 1);

    // Clear restaurant if cart is empty
    if (cart.items.length === 0) {
        cart.restaurant = undefined;
        cart.deliveryFee = 0;
        cart.discount = 0;
        cart.promoCode = undefined;
    }

    await cart.save();

    await cart.populate('items.food', 'name mainImage price discountPrice');
    await cart.populate('restaurant', 'name logo deliveryFee minimumOrder deliveryTime');

    res.status(200).json({
        success: true,
        message: 'Item removed from cart',
        data: cart
    });
});

// @desc    Clear cart
// @route   DELETE /api/cart/clear
// @access  Private
export const clearCart = asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
        res.status(404);
        throw new Error('Cart not found');
    }

    cart.items = [];
    cart.restaurant = undefined;
    cart.subtotal = 0;
    cart.deliveryFee = 0;
    cart.tax = 0;
    cart.discount = 0;
    cart.total = 0;
    cart.promoCode = undefined;

    await cart.save();

    res.status(200).json({
        success: true,
        message: 'Cart cleared',
        data: cart
    });
});

// @desc    Apply promo code
// @route   POST /api/cart/apply-promo
// @access  Private
export const applyPromoCode = asyncHandler(async (req, res) => {
    const { code } = req.body;

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart || cart.items.length === 0) {
        res.status(400);
        throw new Error('Cart is empty');
    }

    // Simple promo code logic (you can expand this)
    const promoCodes = {
        'SAVE10': { type: 'percentage', value: 10, minOrder: 200 },
        'FLAT50': { type: 'fixed', value: 50, minOrder: 300 },
        'FIRST20': { type: 'percentage', value: 20, minOrder: 0, firstOrderOnly: true }
    };

    const promo = promoCodes[code.toUpperCase()];

    if (!promo) {
        res.status(400);
        throw new Error('Invalid promo code');
    }

    if (cart.subtotal < promo.minOrder) {
        res.status(400);
        throw new Error(`Minimum order amount of ₹${promo.minOrder} required for this promo`);
    }

    // Calculate discount
    let discount = 0;
    if (promo.type === 'percentage') {
        discount = (cart.subtotal * promo.value) / 100;
    } else {
        discount = promo.value;
    }

    // Cap discount at subtotal
    discount = Math.min(discount, cart.subtotal);

    cart.promoCode = {
        code: code.toUpperCase(),
        discount,
        type: promo.type
    };
    cart.discount = discount;

    await cart.save();

    await cart.populate('items.food', 'name mainImage price discountPrice');
    await cart.populate('restaurant', 'name logo deliveryFee minimumOrder deliveryTime');

    res.status(200).json({
        success: true,
        message: `Promo code applied! You save ₹${discount}`,
        data: cart
    });
});

// @desc    Remove promo code
// @route   DELETE /api/cart/remove-promo
// @access  Private
export const removePromoCode = asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
        res.status(404);
        throw new Error('Cart not found');
    }

    cart.promoCode = undefined;
    cart.discount = 0;

    await cart.save();

    await cart.populate('items.food', 'name mainImage price discountPrice');
    await cart.populate('restaurant', 'name logo deliveryFee minimumOrder deliveryTime');

    res.status(200).json({
        success: true,
        message: 'Promo code removed',
        data: cart
    });
});

// @desc    Get cart count
// @route   GET /api/cart/count
// @access  Private
export const getCartCount = asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user.id });

    const count = cart ? cart.items.reduce((acc, item) => acc + item.quantity, 0) : 0;

    res.status(200).json({
        success: true,
        data: { count }
    });
});