import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

// Route imports
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import foodRoutes from './routes/foodRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import restaurantRoutes from './routes/restaurantRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import payment from './routes/paymentRoutes.js';
import bannerRoutes from './routes/bannerRoutes.js';
import searchRoutes from './routes/serchRoutes.js';



// Middleware imports
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

// Get __dirname equivalent in ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Rate limiting
// const limiter = rateLimit({
//     windowMs: 10 * 60 * 1000, // 10 minutes
//     max: 100 
// });

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
// app.use(limiter);

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/payments', payment);
app.use('/api/banners', bannerRoutes);
app.use('/api/search', searchRoutes);

// Health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString()
    });
});

// Error Handling
app.use(notFound);
app.use(errorHandler);

export default app;