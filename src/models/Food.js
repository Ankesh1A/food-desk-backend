// models/Food.js
import mongoose from 'mongoose';

const foodSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Food name is required'],
        trim: true,
        maxlength: [100, 'Food name cannot exceed 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    discountPrice: {
        type: Number,
        min: [0, 'Discount price cannot be negative']
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Category is required']
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
       // required: [true, 'Restaurant is required']
    },
    // Cloudinary URLs stored directly
    mainImage: {
        type: String,  // Cloudinary URL
        default: null
    },
    images: [{
        type: String   // Array of Cloudinary URLs
    }],
    isVeg: {
        type: Boolean,
        default: false
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    tags: [String],
    ingredients: [String],
    nutritionInfo: {
        calories: Number,
        protein: Number,
        carbs: Number,
        fat: Number
    },
    preparationTime: {
        type: Number, // in minutes
        default: 30
    },
    ratings: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        count: {
            type: Number,
            default: 0
        }
    },
    orderCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better performance
foodSchema.index({ name: 'text', description: 'text', tags: 'text' });
foodSchema.index({ category: 1, isAvailable: 1 });
foodSchema.index({ restaurant: 1, isAvailable: 1 });
foodSchema.index({ price: 1 });
foodSchema.index({ 'ratings.average': -1 });

const Food = mongoose.model('Food', foodSchema);
export default Food;