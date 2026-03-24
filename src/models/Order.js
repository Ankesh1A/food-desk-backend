import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
    food: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Food',
        required: true
    },
    name: String,
    price: Number,
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    addons: [{
        name: String,
        price: Number
    }],
    specialInstructions: String,
    total: Number
});

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
       
    },
    items: [orderItemSchema],
    deliveryAddress: {
        type: {
            type: String,
            enum: ['home', 'work', 'other'],
            default: 'home'
        },
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
        coordinates: {
            lat: Number,
            lng: Number
        },
        contactName: String,
        contactPhone: String
    },
    pricing: {
        subtotal: { type: Number, required: true },
        deliveryFee: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        tip: { type: Number, default: 0 },
        total: { type: Number, required: true }
    },
    payment: {
        method: {
            type: String,
            enum: ['cod', 'card', 'upi', 'wallet', 'netbanking','razorpay'],
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'pending'
        },
        transactionId: String,
        paidAt: Date
    },
    status: {
        type: String,
        enum: [
            'pending',
            'confirmed',
            'preparing',
            'ready',
            'picked',
            'on_the_way',
            'delivered',
            'cancelled',
            'refunded'
        ],
        default: 'pending'
    },
    statusHistory: [{
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    delivery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Delivery'
    },
    deliveryPerson: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    estimatedDeliveryTime: Date,
    actualDeliveryTime: Date,
    specialInstructions: String,
    promoCode: {
        code: String,
        discount: Number
    },
    isScheduled: {
        type: Boolean,
        default: false
    },
    scheduledTime: Date,
    rating: {
        food: { type: Number, min: 1, max: 5 },
        delivery: { type: Number, min: 1, max: 5 },
        overall: { type: Number, min: 1, max: 5 },
        review: String,
        ratedAt: Date
    },
    cancelReason: String,
    refundAmount: Number,
    refundedAt: Date
}, {
    timestamps: true
});

// Generate order number before save
orderSchema.pre('save', async function() {
    if (!this.orderNumber) {
        const count = await mongoose.model('Order').countDocuments();
        this.orderNumber = `ORD${Date.now()}${count + 1}`;
    }

});

// Add status to history
orderSchema.methods.addStatusHistory = function(status, note, userId) {
    this.statusHistory.push({
        status,
        note,
        updatedBy: userId,
        timestamp: new Date()
    });
    this.status = status;
};

const Order = mongoose.model('Order', orderSchema);
export default Order;