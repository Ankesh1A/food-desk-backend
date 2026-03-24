import Delivery from '../models/Delivery.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import APIFeatures from '../utils/apiFeatures.js';
import { calculateDistance } from '../utils/helpers.js';

// @desc    Get all deliveries
// @route   GET /api/delivery
// @access  Private/Admin
export const getDeliveries = asyncHandler(async (req, res) => {
    const features = new APIFeatures(Delivery.find(), req.query)
        .filter()
        .sort()
        .paginate();

    const deliveries = await features.query
        .populate('order', 'orderNumber')
        .populate('deliveryPerson', 'name phone')
        .populate('restaurant', 'name')
        .populate('customer', 'name phone');

    const pagination = await features.getPaginationInfo(Delivery);

    res.status(200).json({
        success: true,
        count: deliveries.length,
        pagination,
        data: deliveries
    });
});

// @desc    Get delivery by ID
// @route   GET /api/delivery/:id
// @access  Private
export const getDelivery = asyncHandler(async (req, res) => {
    const delivery = await Delivery.findById(req.params.id)
        .populate('order')
        .populate('deliveryPerson', 'name phone avatar')
        .populate('restaurant', 'name phone address')
        .populate('customer', 'name phone');

    if (!delivery) {
        res.status(404);
        throw new Error('Delivery not found');
    }

    res.status(200).json({
        success: true,
        data: delivery
    });
});

// @desc    Get my deliveries (for delivery person)
// @route   GET /api/delivery/my-deliveries
// @access  Private/Delivery
export const getMyDeliveries = asyncHandler(async (req, res) => {
    const { status } = req.query;

    const filter = { deliveryPerson: req.user.id };
    if (status) {
        filter.status = status;
    }

    const features = new APIFeatures(Delivery.find(filter), req.query)
        .sort()
        .paginate();

    const deliveries = await features.query
        .populate('order', 'orderNumber pricing items')
        .populate('restaurant', 'name address phone')
        .populate('customer', 'name phone');

    const pagination = await features.getPaginationInfo(Delivery, filter);

    res.status(200).json({
        success: true,
        count: deliveries.length,
        pagination,
        data: deliveries
    });
});

// @desc    Assign delivery person to order
// @route   POST /api/delivery/assign
// @access  Private/Admin/Restaurant
export const assignDelivery = asyncHandler(async (req, res) => {
    const { orderId, deliveryPersonId } = req.body;

    const order = await Order.findById(orderId)
        .populate('user')
        .populate('restaurant');

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    // Check if delivery person exists and is available
    const deliveryPerson = await User.findOne({ 
        _id: deliveryPersonId, 
        role: 'delivery',
        isActive: true 
    });

    if (!deliveryPerson) {
        res.status(404);
        throw new Error('Delivery person not found or unavailable');
    }

    // Create delivery record
    const delivery = await Delivery.create({
        order: orderId,
        deliveryPerson: deliveryPersonId,
        restaurant: order.restaurant._id,
        customer: order.user._id,
        pickupLocation: {
            address: order.restaurant.address?.street,
            coordinates: order.restaurant.address?.coordinates
        },
        dropLocation: {
            address: order.deliveryAddress?.street,
            coordinates: order.deliveryAddress?.coordinates
        },
        earnings: {
            deliveryFee: order.pricing.deliveryFee,
            tip: order.pricing.tip || 0,
            total: order.pricing.deliveryFee + (order.pricing.tip || 0)
        }
    });

    // Update order
    order.delivery = delivery._id;
    order.deliveryPerson = deliveryPersonId;
    await order.save();

    // Notify delivery person
    await Notification.create({
        user: deliveryPersonId,
        title: 'New Delivery Assigned',
        message: `New delivery #${order.orderNumber} assigned to you`,
        type: 'delivery',
        data: { orderId, deliveryId: delivery._id }
    });

    // Socket notification
    const io = req.app.get('io');
    io.to(deliveryPersonId.toString()).emit('newDeliveryAssigned', {
        deliveryId: delivery._id,
        orderNumber: order.orderNumber
    });

    res.status(201).json({
        success: true,
        message: 'Delivery assigned successfully',
        data: delivery
    });
});

// @desc    Accept delivery
// @route   PUT /api/delivery/:id/accept
// @access  Private/Delivery
export const acceptDelivery = asyncHandler(async (req, res) => {
    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
        res.status(404);
        throw new Error('Delivery not found');
    }

    if (delivery.deliveryPerson.toString() !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized');
    }

    if (delivery.status !== 'assigned') {
        res.status(400);
        throw new Error('Delivery cannot be accepted');
    }

    delivery.status = 'accepted';
    delivery.acceptedAt = new Date();
    await delivery.save();

    // Notify customer
    const order = await Order.findById(delivery.order);
    await Notification.create({
        user: delivery.customer,
        title: 'Delivery Accepted',
        message: `Delivery person is on the way to pick up your order #${order.orderNumber}`,
        type: 'delivery',
        data: { orderId: delivery.order, deliveryId: delivery._id }
    });

    res.status(200).json({
        success: true,
        message: 'Delivery accepted',
        data: delivery
    });
});

// @desc    Update delivery status
// @route   PUT /api/delivery/:id/status
// @access  Private/Delivery
export const updateDeliveryStatus = asyncHandler(async (req, res) => {
    const { status, note } = req.body;

    const delivery = await Delivery.findById(req.params.id)
        .populate('order');

    if (!delivery) {
        res.status(404);
        throw new Error('Delivery not found');
    }

    if (delivery.deliveryPerson.toString() !== req.user.id && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized');
    }

    const validStatuses = ['accepted', 'picked_up', 'on_the_way', 'arrived', 'delivered'];
    if (!validStatuses.includes(status)) {
        res.status(400);
        throw new Error('Invalid status');
    }

    delivery.status = status;

    // Update timestamps based on status
    switch (status) {
        case 'picked_up':
            delivery.pickedUpAt = new Date();
            break;
        case 'delivered':
            delivery.deliveredAt = new Date();
            delivery.actualTime = Math.round(
                (new Date() - delivery.acceptedAt) / 60000
            ); // in minutes
            break;
    }

    await delivery.save();

    // Update order status
    const orderStatusMap = {
        'picked_up': 'picked',
        'on_the_way': 'on_the_way',
        'delivered': 'delivered'
    };

    if (orderStatusMap[status]) {
        const order = await Order.findById(delivery.order._id);
        order.addStatusHistory(orderStatusMap[status], note, req.user.id);
        await order.save();
    }

    // Notify customer
    await Notification.create({
        user: delivery.customer,
        title: 'Delivery Update',
        message: `Your order is ${status.replace('_', ' ')}`,
        type: 'delivery',
        data: { orderId: delivery.order._id, deliveryId: delivery._id }
    });

    // Socket notification
    const io = req.app.get('io');
    io.to(delivery.customer.toString()).emit('deliveryStatusUpdate', {
        deliveryId: delivery._id,
        status
    });

    res.status(200).json({
        success: true,
        message: 'Delivery status updated',
        data: delivery
    });
});

// @desc    Update delivery location
// @route   PUT /api/delivery/:id/location
// @access  Private/Delivery
export const updateLocation = asyncHandler(async (req, res) => {
    const { lat, lng } = req.body;

    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
        res.status(404);
        throw new Error('Delivery not found');
    }

    if (delivery.deliveryPerson.toString() !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized');
    }

    delivery.currentLocation = {
        coordinates: { lat, lng },
        updatedAt: new Date()
    };

    await delivery.save();

    // Emit location to customer via socket
    const io = req.app.get('io');
    io.to(delivery.customer.toString()).emit('deliveryLocationUpdate', {
        deliveryId: delivery._id,
        location: { lat, lng }
    });

    res.status(200).json({
        success: true,
        data: { location: delivery.currentLocation }
    });
});

// @desc    Complete delivery with proof
// @route   PUT /api/delivery/:id/complete
// @access  Private/Delivery
export const completeDelivery = asyncHandler(async (req, res) => {
    const { otp, signature } = req.body;

    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
        res.status(404);
        throw new Error('Delivery not found');
    }

    if (delivery.deliveryPerson.toString() !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized');
    }

    // Handle image upload for proof
    let proofImage = null;
    if (req.file) {
        proofImage = req.file.filename;
    }

    delivery.status = 'delivered';
    delivery.deliveredAt = new Date();
    delivery.proofOfDelivery = {
        image: proofImage,
        signature,
        otp,
        verifiedAt: new Date()
    };

    await delivery.save();

    // Update order status
    const order = await Order.findById(delivery.order);
    order.addStatusHistory('delivered', 'Order delivered successfully', req.user.id);
    order.actualDeliveryTime = new Date();
    order.payment.status = 'completed';
    order.payment.paidAt = new Date();
    await order.save();

    res.status(200).json({
        success: true,
        message: 'Delivery completed successfully',
        data: delivery
    });
});

// @desc    Rate delivery
// @route   POST /api/delivery/:id/rate
// @access  Private
export const rateDelivery = asyncHandler(async (req, res) => {
    const { score, comment } = req.body;

    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
        res.status(404);
        throw new Error('Delivery not found');
    }

    if (delivery.customer.toString() !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized');
    }

    if (delivery.status !== 'delivered') {
        res.status(400);
        throw new Error('Can only rate completed deliveries');
    }

    delivery.rating = {
        score,
        comment,
        ratedAt: new Date()
    };

    await delivery.save();

    res.status(200).json({
        success: true,
        message: 'Delivery rated successfully',
        data: delivery
    });
});

// @desc    Get delivery statistics
// @route   GET /api/delivery/stats
// @access  Private/Delivery
export const getDeliveryStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const filter = { deliveryPerson: req.user.id };

    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const deliveries = await Delivery.find(filter);

    const stats = {
        totalDeliveries: deliveries.length,
        completedDeliveries: deliveries.filter(d => d.status === 'delivered').length,
        totalEarnings: deliveries
            .filter(d => d.status === 'delivered')
            .reduce((acc, d) => acc + (d.earnings?.total || 0), 0),
        averageRating: 0,
        totalTips: deliveries
            .filter(d => d.status === 'delivered')
            .reduce((acc, d) => acc + (d.earnings?.tip || 0), 0)
    };

    // Calculate average rating
    const ratedDeliveries = deliveries.filter(d => d.rating?.score);
    if (ratedDeliveries.length > 0) {
        stats.averageRating = 
            ratedDeliveries.reduce((acc, d) => acc + d.rating.score, 0) / ratedDeliveries.length;
        stats.averageRating = Math.round(stats.averageRating * 10) / 10;
    }

    res.status(200).json({
        success: true,
        data: stats
    });
});

// @desc    Get available deliveries for delivery person
// @route   GET /api/delivery/available
// @access  Private/Delivery
export const getAvailableDeliveries = asyncHandler(async (req, res) => {
    const { lat, lng, radius = 10 } = req.query;

    // Get orders that are ready for pickup and don't have delivery assigned
    const orders = await Order.find({
        status: 'ready',
        deliveryPerson: { $exists: false }
    })
        .populate('restaurant', 'name address')
        .populate('user', 'name');

    // Filter by distance if coordinates provided
    let availableOrders = orders;
    if (lat && lng) {
        availableOrders = orders.filter(order => {
            const restaurantCoords = order.restaurant?.address?.coordinates;
            if (!restaurantCoords?.lat || !restaurantCoords?.lng) return true;

            const distance = calculateDistance(
                parseFloat(lat),
                parseFloat(lng),
                restaurantCoords.lat,
                restaurantCoords.lng
            );
            order._doc.distance = Math.round(distance * 10) / 10;
            return distance <= radius;
        });
    }

    res.status(200).json({
        success: true,
        count: availableOrders.length,
        data: availableOrders
    });
});