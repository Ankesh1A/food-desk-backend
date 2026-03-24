import Notification from '../models/Notification.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import APIFeatures from '../utils/apiFeatures.js';

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = asyncHandler(async (req, res) => {
    const features = new APIFeatures(
        Notification.find({ user: req.user.id }),
        req.query
    )
        .filter()
        .sort()
        .paginate();

    const notifications = await features.query;
    const pagination = await features.getPaginationInfo(Notification, { user: req.user.id });

    // Count unread
    const unreadCount = await Notification.countDocuments({
        user: req.user.id,
        isRead: false
    });

    res.status(200).json({
        success: true,
        count: notifications.length,
        unreadCount,
        pagination,
        data: notifications
    });
});

// @desc    Get single notification
// @route   GET /api/notifications/:id
// @access  Private
export const getNotification = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
        res.status(404);
        throw new Error('Notification not found');
    }

    if (notification.user.toString() !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized');
    }

    res.status(200).json({
        success: true,
        data: notification
    });
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
        res.status(404);
        throw new Error('Notification not found');
    }

    if (notification.user.toString() !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized');
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({
        success: true,
        data: notification
    });
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = asyncHandler(async (req, res) => {
    await Notification.updateMany(
        { user: req.user.id, isRead: false },
        { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
        success: true,
        message: 'All notifications marked as read'
    });
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
        res.status(404);
        throw new Error('Notification not found');
    }

    if (notification.user.toString() !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized');
    }

    await notification.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Notification deleted'
    });
});

// @desc    Delete all notifications
// @route   DELETE /api/notifications/delete-all
// @access  Private
export const deleteAllNotifications = asyncHandler(async (req, res) => {
    await Notification.deleteMany({ user: req.user.id });

    res.status(200).json({
        success: true,
        message: 'All notifications deleted'
    });
});

// @desc    Get unread count
// @route   GET /api/notifications/unread-count
// @access  Private
export const getUnreadCount = asyncHandler(async (req, res) => {
    const count = await Notification.countDocuments({
        user: req.user.id,
        isRead: false
    });

    res.status(200).json({
        success: true,
        data: { count }
    });
});

// @desc    Create notification (Admin/System)
// @route   POST /api/notifications
// @access  Private/Admin
export const createNotification = asyncHandler(async (req, res) => {
    const notification = await Notification.create(req.body);

    // Emit socket event
    const io = req.app.get('io');
    io.to(notification.user.toString()).emit('newNotification', notification);

    res.status(201).json({
        success: true,
        data: notification
    });
});

// @desc    Send bulk notification
// @route   POST /api/notifications/bulk
// @access  Private/Admin
export const sendBulkNotification = asyncHandler(async (req, res) => {
    const { userIds, title, message, type, data } = req.body;

    const notifications = await Notification.insertMany(
        userIds.map(userId => ({
            user: userId,
            title,
            message,
            type,
            data
        }))
    );

    // Emit socket events
    const io = req.app.get('io');
    userIds.forEach((userId, index) => {
        io.to(userId.toString()).emit('newNotification', notifications[index]);
    });

    res.status(201).json({
        success: true,
        message: `Notification sent to ${userIds.length} users`,
        data: notifications
    });
});