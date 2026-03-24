import express from 'express';
import {
    getDeliveries,
    getDelivery,
    getMyDeliveries,
    assignDelivery,
    acceptDelivery,
    updateDeliveryStatus,
    updateLocation,
    completeDelivery,
    rateDelivery,
    getDeliveryStats,
    getAvailableDeliveries
} from '../controllers/deliveryController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { uploadSingle } from '../middleware/uploadMiddleware.js';
import { idValidation, validate } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.use(protect);

// Delivery person routes
router.get('/my-deliveries', authorize('delivery'), getMyDeliveries);
router.get('/available', authorize('delivery'), getAvailableDeliveries);
router.get('/stats', authorize('delivery'), getDeliveryStats);
router.put('/:id/accept', authorize('delivery'), idValidation, validate, acceptDelivery);
router.put('/:id/status', authorize('delivery', 'admin'), idValidation, validate, updateDeliveryStatus);
router.put('/:id/location', authorize('delivery'), idValidation, validate, updateLocation);
router.put('/:id/complete', authorize('delivery'), uploadSingle('proofImage'), idValidation, validate, completeDelivery);

// Customer routes
router.post('/:id/rate', idValidation, validate, rateDelivery);
router.get('/:id', idValidation, validate, getDelivery);

// Admin/Restaurant routes
router.get('/', authorize('admin'), getDeliveries);
router.post('/assign', authorize('restaurant', 'admin'), assignDelivery);

export default router;