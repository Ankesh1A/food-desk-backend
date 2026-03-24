// config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';



// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Dynamic folder based on field name
const getFolder = (fieldname) => {
    if (fieldname === 'avatar' || fieldname === 'profileImage') {
        return 'food-app/users';
    } else if (fieldname === 'foodImage' || fieldname === 'foodImages' || fieldname === 'mainImage') {
        return 'food-app/foods';
    } else if (fieldname === 'logo' || fieldname === 'coverImage' || fieldname === 'restaurantImages') {
        return 'food-app/restaurants';
    } else if (fieldname === 'image') {
        return 'food-app/categories';
    }
    return 'food-app/misc';
};

// Cloudinary storage configuration
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        return {
            folder: getFolder(file.fieldname),
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            transformation: [
                { width: 1000, height: 1000, crop: 'limit' }, // Max dimensions
                { quality: 'auto' } // Auto optimize quality
            ],
            public_id: `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1E9)}`
        };
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(file.originalname.toLowerCase().split('.').pop());

    if (mimetype && extname) {
        return cb(null, true);
    }
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'), false);
};

// Multer upload configuration
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: fileFilter
});

// Export upload functions
export const uploadSingle = (fieldName) => upload.single(fieldName);
export const uploadMultiple = (fieldName, maxCount = 5) => upload.array(fieldName, maxCount);
export const uploadFields = (fields) => upload.fields(fields);

// Delete image from Cloudinary
export const deleteFromCloudinary = async (imageUrl) => {
    try {
        if (!imageUrl) return;
        
        // Extract public_id from URL
        // URL format: https://res.cloudinary.com/cloud_name/image/upload/v123/folder/public_id.jpg
        const urlParts = imageUrl.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        
        if (uploadIndex !== -1) {
            // Get everything after 'upload/v123/' and remove extension
            const publicIdWithFolder = urlParts.slice(uploadIndex + 2).join('/');
            const publicId = publicIdWithFolder.replace(/\.[^/.]+$/, ''); // Remove extension
            
            const result = await cloudinary.uploader.destroy(publicId);
            console.log('Cloudinary delete result:', result);
            return result;
        }
    } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
    }
};

// Delete multiple images
export const deleteMultipleFromCloudinary = async (imageUrls) => {
    try {
        if (!imageUrls || imageUrls.length === 0) return;
        
        const deletePromises = imageUrls.map(url => deleteFromCloudinary(url));
        await Promise.all(deletePromises);
    } catch (error) {
        console.error('Error deleting multiple images from Cloudinary:', error);
    }
};

export { cloudinary };
export default upload;