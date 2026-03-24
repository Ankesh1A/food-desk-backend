import Invoice from '../models/Invoice.js';
import Order from '../models/Order.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import APIFeatures from '../utils/apiFeatures.js';
import sendEmail, { emailTemplates } from '../utils/sendEmail.js';

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private/Admin
export const getInvoices = asyncHandler(async (req, res) => {
    const features = new APIFeatures(Invoice.find(), req.query)
        .filter()
        .sort()
        .paginate();

    const invoices = await features.query
        .populate('user', 'name email')
        .populate('restaurant', 'name')
        .populate('order', 'orderNumber');

    const pagination = await features.getPaginationInfo(Invoice);

    res.status(200).json({
        success: true,
        count: invoices.length,
        pagination,
        data: invoices
    });
});

// @desc    Get user invoices
// @route   GET /api/invoices/my-invoices
// @access  Private
export const getMyInvoices = asyncHandler(async (req, res) => {
    const features = new APIFeatures(Invoice.find({ user: req.user.id }), req.query)
        .sort()
        .paginate();

    const invoices = await features.query
        .populate('restaurant', 'name')
        .populate('order', 'orderNumber');

    const pagination = await features.getPaginationInfo(Invoice, { user: req.user.id });

    res.status(200).json({
        success: true,
        count: invoices.length,
        pagination,
        data: invoices
    });
});

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
export const getInvoice = asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id)
        .populate('user', 'name email phone')
        .populate('restaurant', 'name address phone email')
        .populate('order');

    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found');
    }

    // Check authorization
    if (
        invoice.user._id.toString() !== req.user.id &&
        req.user.role !== 'admin' &&
        invoice.restaurant?.owner?.toString() !== req.user.id
    ) {
        res.status(403);
        throw new Error('Not authorized to view this invoice');
    }

    res.status(200).json({
        success: true,
        data: invoice
    });
});

// @desc    Create invoice from order
// @route   POST /api/invoices
// @access  Private/Admin/Restaurant
export const createInvoice = asyncHandler(async (req, res) => {
    const { orderId } = req.body;

    const order = await Order.findById(orderId)
        .populate('user', 'name email phone address')
        .populate('restaurant', 'name address phone email')
        .populate('items.food', 'name');

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    // Check if invoice already exists for this order
    const existingInvoice = await Invoice.findOne({ order: orderId });
    if (existingInvoice) {
        res.status(400);
        throw new Error('Invoice already exists for this order');
    }

    // Prepare invoice items
    const invoiceItems = order.items.map(item => ({
        name: item.name || item.food?.name,
        description: item.specialInstructions || '',
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.total
    }));

    // Get user's default address or delivery address
    const billingAddress = {
        name: order.user.name,
        email: order.user.email,
        phone: order.user.phone,
        street: order.deliveryAddress?.street,
        city: order.deliveryAddress?.city,
        state: order.deliveryAddress?.state,
        zipCode: order.deliveryAddress?.zipCode,
        country: order.deliveryAddress?.country || 'India'
    };

    // Calculate tax breakdown
    const taxBreakdown = [
        {
            name: 'CGST',
            rate: 2.5,
            amount: order.pricing.subtotal * 0.025
        },
        {
            name: 'SGST',
            rate: 2.5,
            amount: order.pricing.subtotal * 0.025
        }
    ];

    const invoice = await Invoice.create({
        order: orderId,
        user: order.user._id,
        restaurant: order.restaurant._id,
        billingAddress,
        items: invoiceItems,
        pricing: {
            subtotal: order.pricing.subtotal,
            deliveryFee: order.pricing.deliveryFee,
            tax: order.pricing.tax,
            taxBreakdown,
            discount: order.pricing.discount,
            total: order.pricing.total
        },
        payment: {
            method: order.payment.method,
            status: order.payment.status,
            transactionId: order.payment.transactionId,
            paidAt: order.payment.paidAt
        },
        status: order.payment.status === 'completed' ? 'paid' : 'sent',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        notes: `Invoice for Order #${order.orderNumber}`,
        terms: 'Payment is due within 7 days. Thank you for your order!'
    });

    // Send invoice email
    try {
        const template = emailTemplates.invoice(invoice);
        await sendEmail({
            email: order.user.email,
            subject: template.subject,
            html: template.html
        });
    } catch (error) {
        console.error('Invoice email error:', error);
    }

    res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: invoice
    });
});

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private/Admin
export const updateInvoice = asyncHandler(async (req, res) => {
    let invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found');
    }

    const allowedUpdates = ['status', 'notes', 'terms', 'dueDate', 'payment'];
    const updates = {};

    allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    });

    invoice = await Invoice.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        success: true,
        message: 'Invoice updated successfully',
        data: invoice
    });
});

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private/Admin
export const deleteInvoice = asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found');
    }

    await invoice.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Invoice deleted successfully'
    });
});

// @desc    Send invoice to email
// @route   POST /api/invoices/:id/send
// @access  Private
export const sendInvoiceEmail = asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id)
        .populate('user', 'name email')
        .populate('restaurant', 'name');

    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found');
    }

    const template = emailTemplates.invoice(invoice);
    await sendEmail({
        email: req.body.email || invoice.user.email,
        subject: template.subject,
        html: template.html
    });

    res.status(200).json({
        success: true,
        message: 'Invoice sent successfully'
    });
});

// @desc    Download invoice as PDF
// @route   GET /api/invoices/:id/download
// @access  Private
export const downloadInvoice = asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id)
        .populate('user', 'name email phone')
        .populate('restaurant', 'name address phone email')
        .populate('order', 'orderNumber');

    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found');
    }

    // Check authorization
    if (invoice.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized');
    }

    // Generate HTML for PDF (simplified version)
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .invoice-details { margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #f4f4f4; }
                .total-row { font-weight: bold; }
                .footer { margin-top: 30px; text-align: center; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>INVOICE</h1>
                <p>Invoice #: ${invoice.invoiceNumber}</p>
                <p>Date: ${new Date(invoice.createdAt).toLocaleDateString()}</p>
            </div>
            
            <div class="invoice-details">
                <h3>Bill To:</h3>
                <p>${invoice.billingAddress.name}</p>
                <p>${invoice.billingAddress.street}</p>
                <p>${invoice.billingAddress.city}, ${invoice.billingAddress.state} ${invoice.billingAddress.zipCode}</p>
                <p>Email: ${invoice.billingAddress.email}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.items.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.quantity}</td>
                            <td>₹${item.unitPrice.toFixed(2)}</td>
                            <td>₹${item.total.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                    <tr>
                        <td colspan="3">Subtotal</td>
                        <td>₹${invoice.pricing.subtotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td colspan="3">Delivery Fee</td>
                        <td>₹${invoice.pricing.deliveryFee.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td colspan="3">Tax (5%)</td>
                        <td>₹${invoice.pricing.tax.toFixed(2)}</td>
                    </tr>
                    ${invoice.pricing.discount > 0 ? `
                        <tr>
                            <td colspan="3">Discount</td>
                            <td>-₹${invoice.pricing.discount.toFixed(2)}</td>
                        </tr>
                    ` : ''}
                    <tr class="total-row">
                        <td colspan="3">Total</td>
                        <td>₹${invoice.pricing.total.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="footer">
                <p>Thank you for your order!</p>
                <p>${invoice.terms || ''}</p>
            </div>
        </body>
        </html>
    `;

    // For now, return HTML (you can use libraries like puppeteer or html-pdf for actual PDF)
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.html`);
    res.send(html);
});

// @desc    Get invoice statistics
// @route   GET /api/invoices/stats
// @access  Private/Admin
export const getInvoiceStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const filter = {};
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const stats = await Invoice.aggregate([
        { $match: filter },
        {
            $group: {
                _id: null,
                totalInvoices: { $sum: 1 },
                totalAmount: { $sum: '$pricing.total' },
                paidAmount: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'paid'] }, '$pricing.total', 0]
                    }
                },
                pendingAmount: {
                    $sum: {
                        $cond: [{ $in: ['$status', ['sent', 'draft']] }, '$pricing.total', 0]
                    }
                },
                paidCount: {
                    $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
                },
                pendingCount: {
                    $sum: { $cond: [{ $in: ['$status', ['sent', 'draft']] }, 1, 0] }
                },
                overdueCount: {
                    $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
                }
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: stats[0] || {
            totalInvoices: 0,
            totalAmount: 0,
            paidAmount: 0,
            pendingAmount: 0,
            paidCount: 0,
            pendingCount: 0,
            overdueCount: 0
        }
    });
});