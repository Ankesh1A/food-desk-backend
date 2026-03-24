import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: {
        type: String,
        unique: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    billingAddress: {
        name: String,
        email: String,
        phone: String,
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
    },
    items: [{
        name: String,
        description: String,
        quantity: Number,
        unitPrice: Number,
        total: Number
    }],
    pricing: {
        subtotal: Number,
        deliveryFee: Number,
        tax: Number,
        taxBreakdown: [{
            name: String,
            rate: Number,
            amount: Number
        }],
        discount: Number,
        total: Number
    },
    payment: {
        method: String,
        status: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending'
        },
        transactionId: String,
        paidAt: Date
    },
    status: {
        type: String,
        enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
        default: 'draft'
    },
    dueDate: Date,
    notes: String,
    terms: String,
    pdfUrl: String
}, {
    timestamps: true
});

// Generate invoice number
invoiceSchema.pre('save', async function() {
    if (!this.invoiceNumber) {
        const year = new Date().getFullYear();
        const count = await mongoose.model('Invoice').countDocuments();
        this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(6, '0')}`;
    }
 
});

const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;