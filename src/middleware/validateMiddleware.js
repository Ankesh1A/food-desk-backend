import { validationResult, body, param, query } from 'express-validator';

// Validation result handler
export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

// User validation rules
export const userValidation = {
    register: [
        body('name')
            .trim()
            .notEmpty().withMessage('Name is required')
            .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Please provide a valid email')
            .normalizeEmail(),
        body('password')
            .notEmpty().withMessage('Password is required')
            .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('phone')
            .optional()
            .isMobilePhone().withMessage('Please provide a valid phone number')
    ],
    login: [
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Please provide a valid email'),
        body('password')
            .notEmpty().withMessage('Password is required')
    ],
    updateProfile: [
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
        body('phone')
            .optional()
            .isMobilePhone().withMessage('Please provide a valid phone number')
    ]
};

// Food validation rules
export const foodValidation = {
    create: [
        body('name')
            .trim()
            .notEmpty().withMessage('Food name is required')
            .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
        body('description')
            .trim()
            .notEmpty().withMessage('Description is required')
            .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
        body('price')
            .notEmpty().withMessage('Price is required')
            .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
        body('category')
            .notEmpty().withMessage('Category is required')
            .isMongoId().withMessage('Invalid category ID'),
        body('restaurant')
            .notEmpty().withMessage('Restaurant is required')
            .isMongoId().withMessage('Invalid restaurant ID')
    ],
    update: [
        body('name')
            .optional()
            .trim()
            .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
        body('price')
            .optional()
            .isFloat({ min: 0 }).withMessage('Price must be a positive number')
    ]
};

// Order validation rules
export const orderValidation = {
    create: [
        body('items')
            .isArray({ min: 1 }).withMessage('Order must have at least one item'),
        body('items.*.food')
            .isMongoId().withMessage('Invalid food ID'),
        body('items.*.quantity')
            .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
        body('deliveryAddress')
            .notEmpty().withMessage('Delivery address is required'),
        body('payment.method')
            .notEmpty().withMessage('Payment method is required')
            .isIn(['cod', 'card', 'upi', 'wallet', 'netbanking']).withMessage('Invalid payment method')
    ]
};

// Review validation rules
export const reviewValidation = {
    create: [
        body('rating')
            .notEmpty().withMessage('Rating is required')
            .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
        body('comment')
            .trim()
            .notEmpty().withMessage('Comment is required')
            .isLength({ max: 1000 }).withMessage('Comment cannot exceed 1000 characters')
    ]
};

// Common validations
export const idValidation = [
    param('id')
        .isMongoId().withMessage('Invalid ID format')
];

export const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];