import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add category name'],
        unique: true,
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        maxlength: [200, 'Description cannot be more than 200 characters']
    },
    image: {
        type: String,
        default: 'default-category.png'
    },
    icon: {
        type: String
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    sortOrder: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Create slug from name
categorySchema.pre('save', function() {
    this.slug = this.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
  
});

// Virtual for subcategories
categorySchema.virtual('subcategories', {
    ref: 'Category',
    localField: '_id',
    foreignField: 'parent'
});

const Category = mongoose.model('Category', categorySchema);
export default Category;