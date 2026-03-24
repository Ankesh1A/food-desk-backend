import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
    food: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Food',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    addons: [{
        name: String,
        price: Number
    }],
    specialInstructions: String,
    price: Number,
    total: Number
});

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant'
    },
    items: [cartItemSchema],
    subtotal: {
        type: Number,
        default: 0
    },
    deliveryFee: {
        type: Number,
        default: 0
    },
    tax: {
        type: Number,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        default: 0
    },
    promoCode: {
        code: String,
        discount: Number,
        type: { type: String, enum: ['percentage', 'fixed'] }
    }
}, {
    timestamps: true
});

// Calculate totals before save
cartSchema.pre('save', function() {
    this.subtotal = this.items.reduce((acc, item) => acc + item.total, 0);
    this.tax = this.subtotal * 0.05; // 5% tax
    this.total = this.subtotal + this.deliveryFee + this.tax - this.discount;
 
});

const Cart = mongoose.model('Cart', cartSchema);
export default Cart;