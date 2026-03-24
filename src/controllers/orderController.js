import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Food from '../models/Food.js';
import User from '../models/User.js';
import Restaurant from '../models/Restaurant.js';
import Notification from '../models/Notification.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import APIFeatures from '../utils/apiFeatures.js';
import sendEmail, { emailTemplates } from '../utils/sendEmail.js';


import Razorpay from 'razorpay';

import Payment from '../models/Payment.js';


// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

export const getOrders = asyncHandler(async (req, res) => {
    const features = new APIFeatures(Order.find(), req.query)
        .filter()
        .sort()
        .paginate();

    const orders = await features.query
        .populate('user', 'name email phone')
        .populate('restaurant', 'name')
        .populate('items.food', 'name mainImage');

    const pagination = await features.getPaginationInfo(Order);

    res.status(200).json({
        success: true,
        count: orders.length,
        pagination,
        data: orders
    });
});

// @desc    Get user orders
// @route   GET /api/orders/my-orders
// @access  Private
export const getMyOrders = asyncHandler(async (req, res) => {
    const features = new APIFeatures(Order.find({ user: req.user.id }), req.query)
        .filter()
        .sort()
        .paginate();

    const orders = await features.query
        .populate('restaurant', 'name logo')
        .populate('items.food', 'name mainImage');

    const pagination = await features.getPaginationInfo(Order, { user: req.user.id });

    res.status(200).json({
        success: true,
        count: orders.length,
        pagination,
        data: orders
    });
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
export const getOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)
        .populate('user', 'name email phone')
        .populate('restaurant', 'name logo address phone')
        .populate('items.food', 'name mainImage price')
        .populate('deliveryPerson', 'name phone');

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    // Check if user is authorized to view this order
    if (
        order.user._id.toString() !== req.user.id &&
        req.user.role !== 'admin' &&
        order.restaurant.owner?.toString() !== req.user.id
    ) {
        res.status(403);
        throw new Error('Not authorized to view this order');
    }

    res.status(200).json({
        success: true,
        data: order
    });
});

// @desc    Create order
// @route   POST /api/orders
// @access  Private
// @desc    Create order
// @route   POST /api/orders
// @access  Private
export const createOrder = asyncHandler(async (req, res) => {
    const {
        items,
        deliveryAddress,
        payment,
        specialInstructions,
        promoCode,
        isScheduled,
        scheduledTime
    } = req.body;

    // Validate items
    if (!items || items.length === 0) {
        res.status(400);
        throw new Error('Order must have at least one item');
    }

    // Get food details and calculate prices
    let subtotal = 0;
    const orderItems = [];
    let restaurantId = null;

    for (const item of items) {
        const food = await Food.findById(item.food);
        if (!food) {
            res.status(404);
            throw new Error(`Food item ${item.food} not found`);
        }

        if (!food.isAvailable) {
            res.status(400);
            throw new Error(`${food.name} is currently unavailable`);
        }

        // Get restaurant ID from first item (no validation)
        if (!restaurantId) {
            restaurantId = food.restaurant;
        }

        const itemPrice = food.discountPrice || food.price;
        let addonsTotal = 0;

        // Calculate addons
        if (item.addons && item.addons.length > 0) {
            item.addons.forEach(addon => {
                addonsTotal += addon.price || 0;
            });
        }

        const itemTotal = (itemPrice + addonsTotal) * item.quantity;
        subtotal += itemTotal;

        orderItems.push({
            food: food._id,
            name: food.name,
            price: itemPrice,
            quantity: item.quantity,
            addons: item.addons || [],
            specialInstructions: item.specialInstructions,
            total: itemTotal
        });

        // Update food order count
        food.orderCount += item.quantity;
        await food.save();
    }

    // Calculate pricing (NO RESTAURANT LOGIC)
    const deliveryFee = 0; // Default delivery fee
    const tax = subtotal * 0.05; // 5% tax
    let discount = 0;

    // Apply promo code discount (simplified)
    if (promoCode) {
        // You can implement promo code logic here
        discount = 0;
    }

    const total = subtotal + deliveryFee + tax - discount;

    // Handle deliveryAddress - can be ID or object
    let finalDeliveryAddress;
    if (typeof deliveryAddress === 'string') {
        // It's an address ID - fetch from user's addresses
        const User = require('../models/User.js').default || require('../models/User.js');
        const user = await User.findById(req.user.id);
        const userAddress = user.address.id(deliveryAddress);
        if (!userAddress) {
            res.status(404);
            throw new Error('Delivery address not found');
        }
        finalDeliveryAddress = userAddress.toObject();
    } else if (typeof deliveryAddress === 'object') {
        // It's the full address object
        finalDeliveryAddress = deliveryAddress;
    } else {
        res.status(400);
        throw new Error('Invalid delivery address format');
    }

    // Create order
    const order = await Order.create({
        user: req.user.id,
        restaurant: restaurantId, // Just store the ID, no validation
        items: orderItems,
        deliveryAddress: finalDeliveryAddress,
        pricing: {
            subtotal,
            deliveryFee,
            tax,
            discount,
            total
        },
        payment: {
            method: payment?.method || 'cod',
            status: 'pending'
        },
        specialInstructions,
        promoCode: promoCode ? { code: promoCode, discount } : undefined,
        isScheduled,
        scheduledTime: isScheduled ? scheduledTime : undefined,
        estimatedDeliveryTime: new Date(Date.now() + (45 * 60 * 1000)) // Default 45 mins
    });

    // Add initial status to history
    order.addStatusHistory('pending', 'Order placed', req.user.id);
    await order.save();

    // Clear user's cart
    await Cart.findOneAndDelete({ user: req.user.id });

    // Create notification for user
    await Notification.create({
        user: req.user.id,
        title: 'Order Placed Successfully',
        message: `Your order #${order.orderNumber} has been placed`,
        type: 'order',
        data: { orderId: order._id }
    });

    // Send email confirmation
    try {
        const populatedOrder = await Order.findById(order._id)
            .populate('restaurant', 'name');
        const template = emailTemplates.orderConfirmation(populatedOrder);
        await sendEmail({
            email: req.user.email,
            subject: template.subject,
            html: template.html
        });
    } catch (error) {
        console.error('Email send error:', error);
    }

    res.status(201).json({
        success: true,
        message: 'Order placed successfully',
        data: order
    });
});

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Restaurant/Admin/Delivery
export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status, note } = req.body;

    const order = await Order.findById(req.params.id)
        .populate('user', 'name email')
          .populate('restaurant', 'name owner');

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    // Validate status transition
    const validTransitions = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['preparing', 'cancelled'],
        preparing: ['ready', 'cancelled'],
        ready: ['picked', 'cancelled'],
        picked: ['on_the_way'],
        on_the_way: ['delivered'],
        delivered: [],
        cancelled: []
    };

    if (!validTransitions[order.status].includes(status)) {
        res.status(400);
        throw new Error(`Cannot change status from ${order.status} to ${status}`);
    }

    // Update status
    order.addStatusHistory(status, note, req.user.id);

    // Handle specific status updates
    if (status === 'delivered') {
        order.actualDeliveryTime = new Date();
        order.payment.status = 'completed';
        order.payment.paidAt = new Date();
    }

    if (status === 'cancelled') {
        order.cancelReason = note || 'Cancelled by user';
        if (order.payment.status === 'completed') {
            order.refundAmount = order.pricing.total;
            order.refundedAt = new Date();
            order.payment.status = 'refunded';
        }
    }

    await order.save();

    // Create notification
    await Notification.create({
        user: order.user._id,
        title: 'Order Status Updated',
        message: `Your order #${order.orderNumber} is now ${status.replace('_', ' ')}`,
        type: 'order',
        data: { orderId: order._id }
    });

    // Send email notification
    try {
        const template = emailTemplates.orderStatusUpdate(order, status);
        await sendEmail({
            email: order.user.email,
            subject: template.subject,
            html: template.html
        });
    } catch (error) {
        console.error('Email send error:', error);
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(order.user._id.toString()).emit('orderStatusUpdate', {
        orderId: order._id,
        status,
        orderNumber: order.orderNumber
    });

    res.status(200).json({
        success: true,
        message: 'Order status updated successfully',
        data: order
    });
});

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private

export const cancelOrder = asyncHandler(async (req, res) => {
    const { reason } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    // Check if user owns this order
    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized to cancel this order');
    }

    // Check if order can be cancelled
    const cancellableStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'picked', 'on_the_way'];
    if (!cancellableStatuses.includes(order.status)) {
        res.status(400);
        throw new Error('Order cannot be cancelled at this stage');
    }

    // Add to status history and update status
    order.addStatusHistory('cancelled', reason || 'Cancelled by user', req.user.id);
    order.cancelReason = reason || 'Cancelled by user';

    // Process refund if payment was completed AND order is NOT delivered
    if (order.payment.status === 'completed' && order.status !== 'delivered') {
        try {
            // Find the payment record
            const payment = await Payment.findOne({ order: order._id });

            if (payment && payment.method === 'razorpay' && payment.razorpayPaymentId) {
                // Initiate Razorpay refund
                const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
                    amount: Math.round(order.pricing.total * 100), // Amount in paise
                    speed: 'normal',
                    notes: {
                        reason: reason || 'Cancelled by user',
                        orderId: order._id.toString(),
                        orderNumber: order.orderNumber
                    }
                });

                console.log('✅ Razorpay refund initiated:', refund.id);

                // Update payment record with refund details
                payment.status = 'refunded';
                payment.refund = {
                    refundId: refund.id,
                    amount: order.pricing.total,
                    status: 'processing',
                    reason: reason || 'Cancelled by user',
                    refundedAt: new Date()
                };
                await payment.save();

                // Update order with refund info
                order.refundAmount = order.pricing.total;
                order.refundedAt = new Date();
                order.payment.status = 'refunded';

            } else if (payment && payment.method === 'wallet') {
                // For wallet payments - credit back to wallet
                const Wallet = (await import('../models/Wallet.js')).default;
                let wallet = await Wallet.findOne({ user: order.user });
                if (!wallet) {
                    wallet = await Wallet.create({ user: order.user });
                }

                await wallet.credit(order.pricing.total, `Refund for cancelled order #${order.orderNumber}`, order._id.toString());

                // Update payment
                payment.status = 'refunded';
                payment.refund = {
                    amount: order.pricing.total,
                    status: 'completed',
                    reason: reason || 'Cancelled by user',
                    refundedAt: new Date()
                };
                await payment.save();

                // Update order
                order.refundAmount = order.pricing.total;
                order.refundedAt = new Date();
                order.payment.status = 'refunded';

                console.log('✅ Wallet refund completed:', order.pricing.total);

            } else if (payment && payment.method === 'cod') {
                // COD - No refund needed as payment wasn't collected yet
                console.log('ℹ️ COD order cancelled - no refund needed');
            }

        } catch (refundError) {
            console.error('❌ Refund Error:', refundError);
            
            // Don't stop the cancellation even if refund fails
            // Just mark it as pending
            order.payment.status = 'refund_pending';
            
            // Create admin notification about failed refund
            await Notification.create({
                user: order.user,
                title: 'Refund Processing',
                message: `Your order #${order.orderNumber} was cancelled. Refund is being processed and will be completed within 5-7 business days.`,
                type: 'payment',
                data: { orderId: order._id }
            });
        }
    }

    await order.save();

    // Create notification for user
    const notificationMessage = order.refundAmount 
        ? `Your order #${order.orderNumber} has been cancelled. Refund of ₹${order.refundAmount} will be processed within 5-7 business days.`
        : `Your order #${order.orderNumber} has been cancelled.`;

    await Notification.create({
        user: order.user,
        title: 'Order Cancelled',
        message: notificationMessage,
        type: 'order',
        data: { orderId: order._id }
    });

    // Send socket notification
    const io = req.app.get('io');
    if (io) {
        io.to(order.user.toString()).emit('orderCancelled', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            refundAmount: order.refundAmount
        });
    }

    res.status(200).json({
        success: true,
        message: order.refundAmount 
            ? 'Order cancelled successfully. Refund will be processed within 5-7 business days.' 
            : 'Order cancelled successfully',
        data: order
    });
});

// @desc    Rate order
// @route   POST /api/orders/:id/rate
// @access  Private
export const rateOrder = asyncHandler(async (req, res) => {
    const { food, delivery, overall, review } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    if (order.user.toString() !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized to rate this order');
    }

    if (order.status !== 'delivered') {
        res.status(400);
        throw new Error('Can only rate delivered orders');
    }

    if (order.rating && order.rating.overall) {
        res.status(400);
        throw new Error('Order has already been rated');
    }

    order.rating = {
        food,
        delivery,
        overall,
        review,
        ratedAt: new Date()
    };

    await order.save();

    res.status(200).json({
        success: true,
        message: 'Order rated successfully',
        data: order
    });
});

// @desc    Get order history
// @route   GET /api/orders/history
// @access  Private
export const getOrderHistory = asyncHandler(async (req, res) => {
    const { status, startDate, endDate, limit = 10, page = 1 } = req.query;

    const filter = { user: req.user.id };

    if (status) {
        filter.status = status;
    }

    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const orders = await Order.find(filter)
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit))
        .populate('restaurant', 'name logo')
        .populate('items.food', 'name mainImage');

    const total = await Order.countDocuments(filter);

    res.status(200).json({
        success: true,
        count: orders.length,
        pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        },
        data: orders
    });
});

// @desc    Reorder
// @route   POST /api/orders/:id/reorder
// @access  Private
export const reorder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).populate('items.food');

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    if (order.user.toString() !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized');
    }

    // Add items to cart
    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
        cart = await Cart.create({
            user: req.user.id,
            restaurant: order.restaurant,
            items: []
        });
    } else if (cart.restaurant?.toString() !== order.restaurant.toString()) {
        // Clear cart if different restaurant
        cart.items = [];
        cart.restaurant = order.restaurant;
    }

    // Add items from previous order
    for (const item of order.items) {
        const food = await Food.findById(item.food);
        if (food && food.isAvailable) {
            const existingItemIndex = cart.items.findIndex(
                i => i.food.toString() === item.food._id.toString()
            );

            if (existingItemIndex > -1) {
                cart.items[existingItemIndex].quantity += item.quantity;
                cart.items[existingItemIndex].total = 
                    cart.items[existingItemIndex].price * cart.items[existingItemIndex].quantity;
            } else {
                cart.items.push({
                    food: item.food._id,
                    quantity: item.quantity,
                    price: food.discountPrice || food.price,
                    total: (food.discountPrice || food.price) * item.quantity
                });
            }
        }
    }

    await cart.save();

    // Populate cart before sending
    await cart.populate('items.food', 'name mainImage price');
    await cart.populate('restaurant', 'name logo deliveryFee minimumOrder');

    res.status(200).json({
        success: true,
        message: 'Items added to cart',
        data: cart
    });
});

// @desc    Get restaurant orders
// @route   GET /api/orders/restaurant/:restaurantId
// @access  Private/Restaurant
export const getRestaurantOrders = asyncHandler(async (req, res) => {
    const { status, date } = req.query;

    const filter = { restaurant: req.params.restaurantId };

    if (status) {
        filter.status = status;
    }

    if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const features = new APIFeatures(Order.find(filter), req.query)
        .sort()
        .paginate();

    const orders = await features.query
        .populate('user', 'name phone')
        .populate('items.food', 'name');

    const pagination = await features.getPaginationInfo(Order, filter);

    res.status(200).json({
        success: true,
        count: orders.length,
        pagination,
        data: orders
    });
});