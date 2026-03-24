import express from 'express';
import {
    getRazorpayKey,
    createRazorpayOrder,
    verifyPayment,
    payViaCOD,
    payViaWallet,
    getWallet,
    addMoneyToWallet,
    verifyWalletTopup,
    getMyPayments,
    getPayment,
    initiateRefund,
    markCODCollected,
    getAllPayments,
    getPaymentStats
} from '../controllers/paymentControler.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public
router.get('/get-key', getRazorpayKey);

// Protected
router.use(protect);

// Razorpay
router.post('/create-order', createRazorpayOrder);
router.post('/verify', verifyPayment);

// COD
router.post('/cod', payViaCOD);

// Wallet
router.get('/wallet', getWallet);
router.post('/wallet', payViaWallet);
router.post('/wallet/add', addMoneyToWallet);
router.post('/wallet/verify', verifyWalletTopup);

// User payments
router.get('/my-payments', getMyPayments);
router.get('/:id', getPayment);

// Delivery
router.put('/:id/cod-collected', authorize('delivery', 'admin'), markCODCollected);

// Admin
// router.get('/', authorize('admin'), getAllPayments);
// router.get('/admin/stats', authorize('admin'), getPaymentStats);
// router.post('/:id/refund', authorize('admin'), initiateRefund);
router.get('/',  getAllPayments);
router.get('/admin/stats',  getPaymentStats);
router.post('/:id/refund',  initiateRefund);

export default router;