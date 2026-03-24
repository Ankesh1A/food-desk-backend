import express from 'express';
import {
    getAdminDashboard,
    getRestaurantDashboard,
    getDeliveryDashboard,
    getUserDashboard
} from '../controllers/dashboardController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/admin', authorize('admin'), getAdminDashboard);
router.get('/restaurant', authorize('restaurant'), getRestaurantDashboard);
router.get('/delivery', authorize('delivery'), getDeliveryDashboard);
router.get('/user', getUserDashboard);

export default router;