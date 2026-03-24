export const config = {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpire: process.env.JWT_EXPIRE,
    jwtCookieExpire: process.env.JWT_COOKIE_EXPIRE,
    nodeEnv: process.env.NODE_ENV,
    clientUrl: process.env.CLIENT_URL,
    smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        email: process.env.SMTP_EMAIL,
        password: process.env.SMTP_PASSWORD
    },
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
    },
    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY
    }
};