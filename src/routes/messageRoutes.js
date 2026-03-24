import express from 'express';
import {
    getConversations,
    getOrCreateConversation,
    getMessages,
    sendMessage,
    deleteMessage,
    getUnreadCount,
    markConversationAsRead
} from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadMultiple } from '../middleware/uploadMiddleware.js';
import { idValidation, validate } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/conversations', getConversations);
router.post('/conversations', getOrCreateConversation);
router.get('/conversations/:conversationId', getMessages);
router.put('/conversations/:conversationId/read', markConversationAsRead);
router.get('/unread-count', getUnreadCount);
router.post('/', uploadMultiple('attachments', 5), sendMessage);
router.delete('/:id', idValidation, validate, deleteMessage);

export default router;