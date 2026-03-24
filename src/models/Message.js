import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation'
    },
    content: {
        type: String,
        required: [true, 'Message content is required']
    },
    type: {
        type: String,
        enum: ['text', 'image', 'file', 'order', 'location'],
        default: 'text'
    },
    attachments: [{
        type: { type: String },
        url: String,
        name: String,
        size: Number
    }],
    orderRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: Date,
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: Date
}, {
    timestamps: true
});

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    unreadCount: {
        type: Map,
        of: Number,
        default: {}
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

export const Message = mongoose.model('Message', messageSchema);
export const Conversation = mongoose.model('Conversation', conversationSchema);
export default Message;