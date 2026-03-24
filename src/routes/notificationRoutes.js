import express from 'express';
import {
    getNotifications,
    getNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    getUnreadCount,
    createNotification,
    sendBulkNotification
} from '../controllers/notificationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { idValidation, validate } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.delete('/delete-all', deleteAllNotifications);
router.get('/:id', idValidation, validate, getNotification);
router.put('/:id/read', idValidation, validate, markAsRead);
router.delete('/:id', idValidation, validate, deleteNotification);

// Admin routes
router.post('/', authorize('admin'), createNotification);
router.post('/bulk', authorize('admin'), sendBulkNotification);

export default router;