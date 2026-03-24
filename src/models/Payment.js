import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    transactionId: {
        type: String,
        unique: true,
        sparse: true
    },
    razorpayOrderId: {
        type: String
    },
    razorpayPaymentId: {
        type: String
    },
    razorpaySignature: {
        type: String
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    status: {
        type: String,
        enum: ['created', 'pending', 'completed', 'failed', 'refunded'],
        default: 'created'
    },
    method: {
        type: String,
        enum: ['cod', 'razorpay', 'wallet'],
        required: true
    },
    paymentMethod: {
        type: String // card, upi, netbanking, wallet (from razorpay)
    },
    cardDetails: {
        last4: String,
        network: String
    },
    upiId: String,
    bank: String,
    walletName: String,
    refund: {
        refundId: String,
        amount: Number,
        status: String,
        reason: String,
        refundedAt: Date
    },
    failureReason: String,
    paidAt: Date,
    metadata: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

// Generate transaction ID
paymentSchema.pre('save', async function() {
    if (!this.transactionId) {
        const random = Math.random().toString(36).substring(2, 10).toUpperCase();
        this.transactionId = `TXN${Date.now()}${random}`;
    }
   
});

// Indexes
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ order: 1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ razorpayPaymentId: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;