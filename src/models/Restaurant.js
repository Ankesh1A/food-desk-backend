import mongoose from 'mongoose';

const restaurantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add restaurant name'],
        trim: true,
        maxlength: [100, 'Name cannot be more than 100 characters']
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        maxlength: [1000, 'Description cannot be more than 1000 characters']
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    email: {
        type: String,
        required: [true, 'Please add email'],
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please add valid email']
    },
    phone: {
        type: String,
        required: [true, 'Please add phone number']
    },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    logo: {
        type: String,
        default: 'default-restaurant.png'
    },
    coverImage: {
        type: String,
        default: 'default-cover.png'
    },
    images: [{
        type: String
    }],
    cuisine: [{
        type: String
    }],
    categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    priceRange: {
        type: String,
        enum: ['$', '$$', '$$$', '$$$$'],
        default: '$$'
    },
    openingHours: [{
        day: {
            type: String,
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        },
        open: String,
        close: String,
        isClosed: {
            type: Boolean,
            default: false
        }
    }],
    deliveryTime: {
        min: { type: Number, default: 30 },
        max: { type: Number, default: 45 }
    },
    deliveryFee: {
        type: Number,
        default: 0
    },
    minimumOrder: {
        type: Number,
        default: 0
    },
    ratings: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 },
        food: { type: Number, default: 0 },
        service: { type: Number, default: 0 },
        delivery: { type: Number, default: 0 }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isOpen: {
        type: Boolean,
        default: true
    },
    features: {
        dineIn: { type: Boolean, default: false },
        takeaway: { type: Boolean, default: true },
        delivery: { type: Boolean, default: true },
        onlinePayment: { type: Boolean, default: true },
        cashOnDelivery: { type: Boolean, default: true }
    },
    bankDetails: {
        accountName: String,
        accountNumber: String,
        bankName: String,
        ifscCode: String
    },
    documents: {
        license: String,
        fssai: String,
        gst: String
    },
    totalOrders: {
        type: Number,
        default: 0
    },
    totalRevenue: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Create slug
restaurantSchema.pre('save', function() {
    this.slug = this.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
   
});

// Virtual for menu items
restaurantSchema.virtual('menuItems', {
    ref: 'Food',
    localField: '_id',
    foreignField: 'restaurant'
});

// Virtual for reviews
restaurantSchema.virtual('reviews', {
    ref: 'Review',
    localField: '_id',
    foreignField: 'restaurant'
});

const Restaurant = mongoose.model('Restaurant', restaurantSchema);
export default Restaurant;