// middleware/uploadMiddleware.js
import { 
    uploadSingle, 
    uploadMultiple, 
    uploadFields,
    deleteFromCloudinary,
    deleteMultipleFromCloudinary 
} from '../config/cloudinary.js';

// Re-export all functions
export { 
    uploadSingle, 
    uploadMultiple, 
    uploadFields,
    deleteFromCloudinary,
    deleteMultipleFromCloudinary 
};

// Middleware to extract Cloudinary URLs from uploaded files
export const extractCloudinaryUrls = (req, res, next) => {
    // For single file upload
    if (req.file) {
        req.fileUrl = req.file.path; // Cloudinary URL
        req.filePublicId = req.file.filename; // Public ID
    }
    
    // For multiple files upload
    if (req.files) {
        if (Array.isArray(req.files)) {
            req.fileUrls = req.files.map(file => ({
                url: file.path,
                publicId: file.filename
            }));
        } else {
            // For fields upload
            req.fileUrls = {};
            for (const [fieldName, files] of Object.entries(req.files)) {
                req.fileUrls[fieldName] = files.map(file => ({
                    url: file.path,
                    publicId: file.filename
                }));
            }
        }
    }
    
    next();
};