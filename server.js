 import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './src/app.js';
import connectDB from './src/config/db.js';

// Load env vars


// Connect to database
connectDB();

// Create HTTP server
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST','PUT', 'DELETE']
    }
});


// Socket.io connection
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their room`);
    });

    socket.on('sendMessage', (data) => {
        io.to(data.receiverId).emit('receiveMessage', data);
    });

    socket.on('orderUpdate', (data) => {
        io.to(data.userId).emit('orderStatusUpdate', data);
    });

    socket.on('newOrder', (data) => {
        io.to(data.restaurantId).emit('newOrderReceived', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Make io accessible to routes
app.set('io', io);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
    console.log(` Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    httpServer.close(() => process.exit(1));
});

export { io };