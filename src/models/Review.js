import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant'
    },
    food: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Food'
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    rating: {
        type: Number,
        required: [true, 'Please add a rating'],
        min: 1,
        max: 5
    },
    ratings: {
        food: { type: Number, min: 1, max: 5 },
        service: { type: Number, min: 1, max: 5 },
        delivery: { type: Number, min: 1, max: 5 },
        value: { type: Number, min: 1, max: 5 }
    },
    title: {
        type: String,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    comment: {
        type: String,
        required: [true, 'Please add a comment'],
        maxlength: [1000, 'Comment cannot be more than 1000 characters']
    },
    images: [{
        type: String
    }],
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    reply: {
        comment: String,
        repliedAt: Date,
        repliedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    helpfulCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Prevent duplicate reviews
reviewSchema.index({ user: 1, order: 1 }, { unique: true });

// Static method to calculate average ratings
reviewSchema.statics.calculateAverageRatings = async function(restaurantId) {
    const stats = await this.aggregate([
        { $match: { restaurant: restaurantId, isVisible: true } },
        {
            $group: {
                _id: '$restaurant',
                avgRating: { $avg: '$rating' },
                avgFood: { $avg: '$ratings.food' },
                avgService: { $avg: '$ratings.service' },
                avgDelivery: { $avg: '$ratings.delivery' },
                count: { $sum: 1 }
            }
        }
    ]);

    if (stats.length > 0) {
        await mongoose.model('Restaurant').findByIdAndUpdate(restaurantId, {
            'ratings.average': Math.round(stats[0].avgRating * 10) / 10,
            'ratings.food': Math.round(stats[0].avgFood * 10) / 10,
            'ratings.service': Math.round(stats[0].avgService * 10) / 10,
            'ratings.delivery': Math.round(stats[0].avgDelivery * 10) / 10,
            'ratings.count': stats[0].count
        });
    }
};

// Call calculateAverageRatings after save
reviewSchema.post('save', function() {
    this.constructor.calculateAverageRatings(this.restaurant);
});

// Call calculateAverageRatings after remove
reviewSchema.post('remove', function() {
    this.constructor.calculateAverageRatings(this.restaurant);
});

const Review = mongoose.model('Review', reviewSchema);
export default Review;