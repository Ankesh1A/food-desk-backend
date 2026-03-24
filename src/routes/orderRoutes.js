import express from 'express';
import {
    getOrders,
    getMyOrders,
    getOrder,
    createOrder,
    updateOrderStatus,
    cancelOrder,
    rateOrder,
    getOrderHistory,
    reorder,
    getRestaurantOrders
} from '../controllers/orderController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { orderValidation, idValidation, validate } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.use(protect);

// User routes
router.get('/my-orders', getMyOrders);
router.get('/history', getOrderHistory);
router.post('/',  validate, createOrder);
router.get('/:id',  getOrder);
router.put('/:id/cancel',  cancelOrder);
router.post('/:id/rate',  rateOrder);
router.post('/:id/reorder',  reorder);
// Restaurant routes
router.get('/restaurant/:restaurantId', authorize('restaurant', 'admin'), getRestaurantOrders);
router.put('/:id/status', authorize('restaurant', 'admin', 'delivery'),  updateOrderStatus);
// Admin routes
router.get('/', authorize('delivery','restaurant','admin'), getOrders);

export default router;