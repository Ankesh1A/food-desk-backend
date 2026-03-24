// models/Banner.js
import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a banner title'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot be more than 500 characters']
    },
    image: {
        type: String,
        required: [true, 'Please add a banner image']
    },
    link: {
        type: String,
        trim: true
    },
    linkText: {
        type: String,
        trim: true,
        default: 'Learn More'
    },
    sortOrder: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    displayLocation: {
        type: String,
        enum: ['home', 'menu', 'restaurant', 'all'],
        default: 'home'
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Index for faster queries
bannerSchema.index({ isActive: 1, sortOrder: 1 });
bannerSchema.index({ displayLocation: 1 });

// Method to check if banner is currently active
bannerSchema.methods.isCurrentlyActive = function() {
    if (!this.isActive) return false;
    
    const now = new Date();
    
    if (this.startDate && now < this.startDate) return false;
    if (this.endDate && now > this.endDate) return false;
    
    return true;
};

const Banner = mongoose.model('Banner', bannerSchema);

export default Banner;