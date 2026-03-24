import Message, { Conversation } from '../models/Message.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import APIFeatures from '../utils/apiFeatures.js';

// @desc    Get user conversations
// @route   GET /api/messages/conversations
// @access  Private
export const getConversations = asyncHandler(async (req, res) => {
    const conversations = await Conversation.find({
        participants: req.user.id,
        isActive: true
    })
        .populate('participants', 'name avatar')
        .populate('lastMessage')
        .sort('-updatedAt');

    res.status(200).json({
        success: true,
        count: conversations.length,
        data: conversations
    });
});

// @desc    Get or create conversation
// @route   POST /api/messages/conversations
// @access  Private
export const getOrCreateConversation = asyncHandler(async (req, res) => {
    const { userId } = req.body;

    if (userId === req.user.id) {
        res.status(400);
        throw new Error('Cannot create conversation with yourself');
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Check for existing conversation
    let conversation = await Conversation.findOne({
        participants: { $all: [req.user.id, userId] }
    }).populate('participants', 'name avatar');

    if (!conversation) {
        conversation = await Conversation.create({
            participants: [req.user.id, userId]
        });
        await conversation.populate('participants', 'name avatar');
    }

    res.status(200).json({
        success: true,
        data: conversation
    });
});

// @desc    Get messages in conversation
// @route   GET /api/messages/conversations/:conversationId
// @access  Private
export const getMessages = asyncHandler(async (req, res) => {
    const conversation = await Conversation.findById(req.params.conversationId);

    if (!conversation) {
        res.status(404);
        throw new Error('Conversation not found');
    }

    if (!conversation.participants.includes(req.user.id)) {
        res.status(403);
        throw new Error('Not authorized');
    }

    const features = new APIFeatures(
        Message.find({ 
            conversation: req.params.conversationId,
            isDeleted: false 
        }),
        req.query
    )
        .sort()
        .paginate();

    const messages = await features.query
        .populate('sender', 'name avatar')
        .sort('createdAt');

    // Mark messages as read
    await Message.updateMany(
        {
            conversation: req.params.conversationId,
            receiver: req.user.id,
            isRead: false
        },
        { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
        success: true,
        count: messages.length,
        data: messages
    });
});

// @desc    Send message
// @route   POST /api/messages
// @access  Private
export const sendMessage = asyncHandler(async (req, res) => {
    const { receiverId, conversationId, content, type, attachments, orderRef } = req.body;

    let conversation;

    if (conversationId) {
        conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            res.status(404);
            throw new Error('Conversation not found');
        }
    } else if (receiverId) {
        // Get or create conversation
        conversation = await Conversation.findOne({
            participants: { $all: [req.user.id, receiverId] }
        });

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [req.user.id, receiverId]
            });
        }
    } else {
        res.status(400);
        throw new Error('Receiver ID or Conversation ID is required');
    }

    // Get receiver ID from conversation
    const receiver = conversation.participants.find(
        p => p.toString() !== req.user.id
    );

    // Handle file uploads
    let messageAttachments = attachments || [];
    if (req.files && req.files.length > 0) {
        messageAttachments = req.files.map(file => ({
            type: file.mimetype,
            url: file.filename,
            name: file.originalname,
            size: file.size
        }));
    }

    const message = await Message.create({
        sender: req.user.id,
        receiver,
        conversation: conversation._id,
        content,
        type: type || 'text',
        attachments: messageAttachments,
        orderRef
    });

    // Update conversation
    conversation.lastMessage = message._id;
    conversation.unreadCount.set(receiver.toString(), 
        (conversation.unreadCount.get(receiver.toString()) || 0) + 1
    );
    await conversation.save();

    // Populate message
    await message.populate('sender', 'name avatar');

    // Emit socket event
    const io = req.app.get('io');
    io.to(receiver.toString()).emit('receiveMessage', {
        message,
        conversationId: conversation._id
    });

    res.status(201).json({
        success: true,
        data: message
    });
});

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private
export const deleteMessage = asyncHandler(async (req, res) => {
    const message = await Message.findById(req.params.id);

    if (!message) {
        res.status(404);
        throw new Error('Message not found');
    }

    if (message.sender.toString() !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized');
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    res.status(200).json({
        success: true,
        message: 'Message deleted'
    });
});

// @desc    Get unread messages count
// @route   GET /api/messages/unread-count
// @access  Private
export const getUnreadCount = asyncHandler(async (req, res) => {
    const count = await Message.countDocuments({
        receiver: req.user.id,
        isRead: false,
        isDeleted: false
    });

    res.status(200).json({
        success: true,
        data: { count }
    });
});

// @desc    Mark conversation as read
// @route   PUT /api/messages/conversations/:conversationId/read
// @access  Private
export const markConversationAsRead = asyncHandler(async (req, res) => {
    const conversation = await Conversation.findById(req.params.conversationId);

    if (!conversation) {
        res.status(404);
        throw new Error('Conversation not found');
    }

    await Message.updateMany(
        {
            conversation: req.params.conversationId,
            receiver: req.user.id,
            isRead: false
        },
        { isRead: true, readAt: new Date() }
    );

    conversation.unreadCount.set(req.user.id.toString(), 0);
    await conversation.save();

    res.status(200).json({
        success: true,
        message: 'Conversation marked as read'
    });
});