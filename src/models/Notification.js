import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: [true, 'Please add title']
    },
    message: {
        type: String,
        required: [true, 'Please add message']
    },
    type: {
        type: String,
        enum: [
            'order',
            'promotion',
            'delivery',
            'payment',
            'review',
            'system',
            'message',
            'reward'
        ],
        default: 'system'
    },
    data: {
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' },
        foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
        link: String,
        extra: mongoose.Schema.Types.Mixed
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: Date,
    icon: String,
    image: String,
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    }
}, {
    timestamps: true
});

// Index for faster queries
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;