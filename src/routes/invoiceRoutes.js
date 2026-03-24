import express from 'express';
import {
    getInvoices,
    getMyInvoices,
    getInvoice,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    sendInvoiceEmail,
    downloadInvoice,
    getInvoiceStats
} from '../controllers/invoiceController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { idValidation, validate } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.use(protect);

// User routes
router.get('/my-invoices', getMyInvoices);
router.get('/:id', idValidation, validate, getInvoice);
router.get('/:id/download', idValidation, validate, downloadInvoice);

// Admin/Restaurant routes
router.get('/', authorize('admin', 'restaurant'), getInvoices);
router.get('/stats', authorize('admin'), getInvoiceStats);
router.post('/', authorize('admin', 'restaurant'), createInvoice);
router.put('/:id', authorize('admin'), idValidation, validate, updateInvoice);
router.delete('/:id', authorize('admin'), idValidation, validate, deleteInvoice);
router.post('/:id/send', authorize('admin', 'restaurant'), idValidation, validate, sendInvoiceEmail);

export default router;