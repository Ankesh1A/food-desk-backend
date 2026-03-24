import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    food: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Food'
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant'
    },
    type: {
        type: String,
        enum: ['food', 'restaurant'],
        required: true
    }
}, {
    timestamps: true
});

// Compound index to prevent duplicates
favoriteSchema.index({ user: 1, food: 1, type: 1 }, { unique: true, sparse: true });
favoriteSchema.index({ user: 1, restaurant: 1, type: 1 }, { unique: true, sparse: true });

const Favorite = mongoose.model('Favorite', favoriteSchema);
export default Favorite;