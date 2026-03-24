import Razorpay from 'razorpay';
import crypto from 'crypto';
import Payment from '../models/Payment.js';
import Wallet from '../models/Wallet.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

// Initialize Razorpay - ADD ERROR CHECKING
let razorpay = null;

try {
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
        console.log(' Razorpay initialized successfully');
    } else {
        console.error(' Razorpay credentials missing in .env file');
        console.error('Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file');
    }
} catch (error) {
    console.error(' Razorpay initialization error:', error);
}

// @desc    Get Razorpay Key (for frontend)
// @route   GET /api/payments/get-key
// @access  Public
export const getRazorpayKey = asyncHandler(async (req, res) => {
    res.status(200).json({
        success: true,
        key: process.env.RAZORPAY_KEY_ID
    });
});

// @desc    Create Razorpay Order
// @route   POST /api/payments/create-order
// @access  Private
export const createRazorpayOrder = asyncHandler(async (req, res) => {
    try {
        const { orderId } = req.body;

        console.log('=== CREATE RAZORPAY ORDER ===');
        console.log('Order ID:', orderId);

        // Check if Razorpay is initialized
        if (!razorpay) {
            console.error('Razorpay not initialized!');
            res.status(500);
            throw new Error('Payment gateway not configured. Please contact support.');
        }

        // Validate orderId
        if (!orderId) {
            res.status(400);
            throw new Error('Order ID is required');
        }

        // Get order
        const order = await Order.findById(orderId);
        if (!order) {
            console.error('Order not found:', orderId);
            res.status(404);
            throw new Error('Order not found');
        }

        console.log('Order found:', order.orderNumber, 'Total:', order.pricing.total);

        // Check authorization
        if (order.user.toString() !== req.user.id) {
            console.error('Unauthorized access');
            res.status(403);
            throw new Error('Not authorized');
        }

        // Check payment status
        if (order.payment.status === 'completed') {
            res.status(400);
            throw new Error('Order already paid');
        }

        // Amount in paise
        const amountInPaise = Math.round(order.pricing.total * 100);
        
        console.log('Creating Razorpay order with amount:', amountInPaise, 'paise (₹' + order.pricing.total + ')');

        // Create Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `order_${order.orderNumber}`,
            notes: {
                orderId: order._id.toString(),
                orderNumber: order.orderNumber,
                userId: req.user.id
            }
        });

        console.log('✅ Razorpay order created:', razorpayOrder.id);

        // Save payment record
        const payment = await Payment.create({
            user: req.user.id,
            order: orderId,
            razorpayOrderId: razorpayOrder.id,
            amount: order.pricing.total,
            method: 'razorpay',
            status: 'created'
        });

        console.log('✅ Payment record created:', payment._id);

        res.status(200).json({
            success: true,
            data: {
                razorpayOrderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                paymentId: payment._id,
                key: process.env.RAZORPAY_KEY_ID,
                orderDetails: {
                    id: order._id,
                    orderNumber: order.orderNumber,
                    total: order.pricing.total
                },
                prefill: {
                    name: req.user.name,
                    email: req.user.email,
                    contact: req.user.phone || ''
                }
            }
        });

    } catch (error) {
        console.error('=== RAZORPAY ERROR ===');
        console.error('Error:', error);
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        
        // Don't throw again, just send response
        if (!res.headersSent) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Failed to create Razorpay order',
                error: process.env.NODE_ENV === 'development' ? error.toString() : undefined
            });
        }
    }
});

// @desc    Verify Payment
// @route   POST /api/payments/verify
// @access  Private
export const verifyPayment = asyncHandler(async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        paymentId
    } = req.body;

    // Find payment
    const payment = await Payment.findById(paymentId);
    if (!payment) {
        res.status(404);
        throw new Error('Payment not found');
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
        payment.status = 'failed';
        payment.failureReason = 'Invalid signature';
        await payment.save();

        res.status(400);
        throw new Error('Payment verification failed');
    }

    // Get payment details from Razorpay
    const razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);

    // Update payment
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = 'completed';
    payment.paidAt = new Date();
    payment.paymentMethod = razorpayPayment.method;

    // Save payment method details
    if (razorpayPayment.method === 'card' && razorpayPayment.card) {
        payment.cardDetails = {
            last4: razorpayPayment.card.last4,
            network: razorpayPayment.card.network
        };
    } else if (razorpayPayment.method === 'upi') {
        payment.upiId = razorpayPayment.vpa;
    } else if (razorpayPayment.method === 'netbanking') {
        payment.bank = razorpayPayment.bank;
    } else if (razorpayPayment.method === 'wallet') {
        payment.walletName = razorpayPayment.wallet;
    }

    await payment.save();

    // Update order
    const order = await Order.findById(payment.order);
    order.payment.status = 'completed';
    order.payment.method = razorpayPayment.method;
    order.payment.transactionId = razorpay_payment_id;
    order.payment.paidAt = new Date();
    order.addStatusHistory('confirmed', 'Payment received', req.user.id);
    await order.save();

    // Notification
    await Notification.create({
        user: req.user.id,
        title: 'Payment Successful! 🎉',
        message: `Payment of ₹${payment.amount} for Order #${order.orderNumber} was successful`,
        type: 'payment',
        data: { orderId: order._id, paymentId: payment._id }
    });

    // Socket notification
    const io = req.app.get('io');
    if (io) {
        io.to(req.user.id).emit('paymentSuccess', {
            orderId: order._id,
            orderNumber: order.orderNumber
        });
    }

    res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: {
            payment,
            order
        }
    });
});

// @desc    Payment via COD
// @route   POST /api/payments/cod
// @access  Private
export const payViaCOD = asyncHandler(async (req, res) => {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    if (order.user.toString() !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized');
    }

    // Create payment record
    const payment = await Payment.create({
        user: req.user.id,
        order: orderId,
        amount: order.pricing.total,
        method: 'cod',
        status: 'pending'
    });

    // Update order
    order.payment.method = 'cod';
    order.payment.status = 'pending';
    order.addStatusHistory('confirmed', 'Order confirmed - Cash on Delivery', req.user.id);
    await order.save();

    // Notification
    await Notification.create({
        user: req.user.id,
        title: 'Order Confirmed! 🛵',
        message: `Order #${order.orderNumber} confirmed. Pay ₹${order.pricing.total} on delivery.`,
        type: 'order',
        data: { orderId: order._id }
    });

    res.status(200).json({
        success: true,
        message: 'Order placed successfully with Cash on Delivery',
        data: {
            payment,
            order
        }
    });
});

// @desc    Payment via Wallet
// @route   POST /api/payments/wallet
// @access  Private
export const payViaWallet = asyncHandler(async (req, res) => {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    if (order.user.toString() !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized');
    }

    const amount = order.pricing.total;

    // Check wallet balance
    let wallet = await Wallet.findOne({ user: req.user.id });
    if (!wallet) {
        wallet = await Wallet.create({ user: req.user.id });
    }

    if (wallet.balance < amount) {
        res.status(400);
        throw new Error(`Insufficient balance. Wallet: ₹${wallet.balance}, Required: ₹${amount}`);
    }

    // Debit wallet
    await wallet.debit(amount, `Payment for Order #${order.orderNumber}`, orderId);

    // Create payment
    const payment = await Payment.create({
        user: req.user.id,
        order: orderId,
        amount,
        method: 'wallet',
        status: 'completed',
        paidAt: new Date()
    });

    // Update order
    order.payment.method = 'wallet';
    order.payment.status = 'completed';
    order.payment.transactionId = payment.transactionId;
    order.payment.paidAt = new Date();
    order.addStatusHistory('confirmed', 'Payment received via wallet', req.user.id);
    await order.save();

    // Notification
    await Notification.create({
        user: req.user.id,
        title: 'Payment Successful! 🎉',
        message: `₹${amount} paid from wallet. New balance: ₹${wallet.balance}`,
        type: 'payment',
        data: { orderId: order._id }
    });

    res.status(200).json({
        success: true,
        message: 'Payment successful via wallet',
        data: {
            payment,
            order,
            newWalletBalance: wallet.balance
        }
    });
});

// @desc    Get Wallet
// @route   GET /api/payments/wallet
// @access  Private
export const getWallet = asyncHandler(async (req, res) => {
    let wallet = await Wallet.findOne({ user: req.user.id });

    if (!wallet) {
        wallet = await Wallet.create({ user: req.user.id });
    }

    res.status(200).json({
        success: true,
        data: {
            balance: wallet.balance,
            transactions: wallet.transactions.slice(-20).reverse()
        }
    });
});

// @desc    Add money to wallet (via Razorpay)
// @route   POST /api/payments/wallet/add
// @access  Private
export const addMoneyToWallet = asyncHandler(async (req, res) => {
    const { amount } = req.body;

    if (!amount || amount < 1) {
        res.status(400);
        throw new Error('Minimum amount is ₹1');
    }

    if (!razorpay) {
        res.status(500);
        throw new Error('Payment gateway not configured');
    }

    const amountInPaise = Math.round(amount * 100);

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `wallet_${req.user.id}_${Date.now()}`,
        notes: {
            type: 'wallet_topup',
            userId: req.user.id
        }
    });

    res.status(200).json({
        success: true,
        data: {
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: 'INR',
            key: process.env.RAZORPAY_KEY_ID,
            prefill: {
                name: req.user.name,
                email: req.user.email,
                contact: req.user.phone || ''
            }
        }
    });
});

// @desc    Verify wallet top-up
// @route   POST /api/payments/wallet/verify
// @access  Private
export const verifyWalletTopup = asyncHandler(async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        amount
    } = req.body;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

    if (expectedSignature !== razorpay_signature) {
        res.status(400);
        throw new Error('Payment verification failed');
    }

    // Credit wallet
    let wallet = await Wallet.findOne({ user: req.user.id });
    if (!wallet) {
        wallet = await Wallet.create({ user: req.user.id });
    }

    const amountInRupees = amount / 100; // Convert paise to rupees
    await wallet.credit(amountInRupees, 'Wallet top-up via Razorpay', razorpay_payment_id);

    // Notification
    await Notification.create({
        user: req.user.id,
        title: 'Wallet Recharged! 💰',
        message: `₹${amountInRupees} added to wallet. New balance: ₹${wallet.balance}`,
        type: 'payment'
    });

    res.status(200).json({
        success: true,
        message: `₹${amountInRupees} added to wallet`,
        data: {
            newBalance: wallet.balance
        }
    });
});

// @desc    Get my payments
// @route   GET /api/payments/my-payments
// @access  Private
export const getMyPayments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;

    const filter = { user: req.user.id };
    if (status) filter.status = status;

    const payments = await Payment.find(filter)
        .populate('order', 'orderNumber')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

    const total = await Payment.countDocuments(filter);

    res.status(200).json({
        success: true,
        count: payments.length,
        pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        },
        data: payments
    });
});

// @desc    Get payment by ID
// @route   GET /api/payments/:id
// @access  Private
export const getPayment = asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id)
        .populate('order')
        .populate('user', 'name email');

    if (!payment) {
        res.status(404);
        throw new Error('Payment not found');
    }

    if (payment.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized');
    }

    res.status(200).json({
        success: true,
        data: payment
    });
});

// @desc    Initiate Refund
// @route   POST /api/payments/:id/refund
// @access  Private/Admin
export const initiateRefund = asyncHandler(async (req, res) => {
    const { reason, amount } = req.body;

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
        res.status(404);
        throw new Error('Payment not found');
    }

    if (payment.status !== 'completed') {
        res.status(400);
        throw new Error('Can only refund completed payments');
    }

    if (payment.method !== 'razorpay') {
        // For wallet/COD - refund to wallet
        let wallet = await Wallet.findOne({ user: payment.user });
        if (!wallet) {
            wallet = await Wallet.create({ user: payment.user });
        }

        const refundAmount = amount || payment.amount;
        await wallet.credit(refundAmount, `Refund for Order`, payment.order.toString());

        payment.status = 'refunded';
        payment.refund = {
            amount: refundAmount,
            status: 'completed',
            reason: reason || 'Refund processed',
            refundedAt: new Date()
        };
        await payment.save();

        return res.status(200).json({
            success: true,
            message: `₹${refundAmount} refunded to wallet`,
            data: payment
        });
    }

    if (!razorpay) {
        res.status(500);
        throw new Error('Payment gateway not configured');
    }

    // Razorpay refund
    const refundAmount = amount || payment.amount;
    const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: Math.round(refundAmount * 100),
        notes: {
            reason: reason || 'Customer requested refund'
        }
    });

    payment.status = 'refunded';
    payment.refund = {
        refundId: refund.id,
        amount: refundAmount,
        status: 'completed',
        reason: reason || 'Customer requested refund',
        refundedAt: new Date()
    };
    await payment.save();

    // Update order
    const order = await Order.findById(payment.order);
    if (order) {
        order.payment.status = 'refunded';
        order.refundAmount = refundAmount;
        order.refundedAt = new Date();
        order.status = 'refunded';
        await order.save();
    }

    // Notification
    await Notification.create({
        user: payment.user,
        title: 'Refund Processed! 💰',
        message: `Refund of ₹${refundAmount} has been processed`,
        type: 'payment'
    });

    res.status(200).json({
        success: true,
        message: 'Refund initiated successfully',
        data: payment
    });
});

// @desc    Mark COD as paid (Delivery person)
// @route   PUT /api/payments/:id/cod-collected
// @access  Private/Delivery
export const markCODCollected = asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
        res.status(404);
        throw new Error('Payment not found');
    }

    if (payment.method !== 'cod') {
        res.status(400);
        throw new Error('Not a COD payment');
    }

    payment.status = 'completed';
    payment.paidAt = new Date();
    payment.metadata = {
        ...payment.metadata,
        collectedBy: req.user.id,
        collectedAt: new Date()
    };
    await payment.save();

    // Update order
    const order = await Order.findById(payment.order);
    order.payment.status = 'completed';
    order.payment.paidAt = new Date();
    await order.save();

    res.status(200).json({
        success: true,
        message: 'COD payment marked as collected',
        data: payment
    });
});

// @desc    Get all payments (Admin)
// @route   GET /api/payments
// @access  Private/Admin
export const getAllPayments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, method, startDate, endDate } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (method) filter.method = method;
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(filter)
        .populate('user', 'name email')
        .populate('order', 'orderNumber')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

    const total = await Payment.countDocuments(filter);

    res.status(200).json({
        success: true,
        count: payments.length,
        pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        },
        data: payments
    });
});

// @desc    Get payment stats (Admin)
// @route   GET /api/payments/stats
// @access  Private/Admin
export const getPaymentStats = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await Payment.aggregate([
        { $match: { status: 'completed' } },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$amount' },
                totalTransactions: { $sum: 1 },
                avgTransaction: { $avg: '$amount' }
            }
        }
    ]);

    const todayStats = await Payment.aggregate([
        { 
            $match: { 
                status: 'completed',
                paidAt: { $gte: today }
            }
        },
        {
            $group: {
                _id: null,
                revenue: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    const byMethod = await Payment.aggregate([
        { $match: { status: 'completed' } },
        {
            $group: {
                _id: '$method',
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: {
            overall: stats[0] || { totalRevenue: 0, totalTransactions: 0, avgTransaction: 0 },
            today: todayStats[0] || { revenue: 0, count: 0 },
            byMethod
        }
    });
});