import mongoose from 'mongoose';

const deliverySchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    deliveryPerson: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: [
            'assigned',
            'accepted',
            'picked_up',
            'on_the_way',
            'arrived',
            'delivered',
            'cancelled'
        ],
        default: 'assigned'
    },
    pickupLocation: {
        address: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    dropLocation: {
        address: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    currentLocation: {
        coordinates: {
            lat: Number,
            lng: Number
        },
        updatedAt: Date
    },
    distance: {
        type: Number, // in km
        default: 0
    },
    estimatedTime: {
        type: Number, // in minutes
        default: 30
    },
    actualTime: Number,
    assignedAt: {
        type: Date,
        default: Date.now
    },
    acceptedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    earnings: {
        deliveryFee: Number,
        tip: Number,
        total: Number
    },
    rating: {
        score: { type: Number, min: 1, max: 5 },
        comment: String,
        ratedAt: Date
    },
    notes: String,
    proofOfDelivery: {
        image: String,
        signature: String,
        otp: String,
        verifiedAt: Date
    },
    issues: [{
        type: String,
        description: String,
        reportedAt: Date,
        resolvedAt: Date
    }]
}, {
    timestamps: true
});

// Index for location-based queries
deliverySchema.index({ 'currentLocation.coordinates': '2dsphere' });

const Delivery = mongoose.model('Delivery', deliverySchema);
export default Delivery;