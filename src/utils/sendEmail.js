import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD
        }
    });

    const mailOptions = {
        from: `${process.env.FROM_NAME || 'Food Delivery'} <${process.env.SMTP_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        html: options.html || options.message
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    return info;
};

// Email Templates with OTP Support
export const emailTemplates = {
    // OTP Verification Email - NEW
    otpVerification: (otp, name) => ({
        subject: 'Verify Your Email - OTP',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #e74c3c; margin: 0;">Food Delivery</h1>
                </div>
                
                <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px; text-align: center;">
                    <h2 style="color: #2c3e50; margin-bottom: 10px;">Email Verification</h2>
                    <p style="color: #7f8c8d; margin-bottom: 30px;">Hi ${name}, use the OTP below to verify your email address.</p>
                    
                    <div style="background-color: #e74c3c; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px 40px; border-radius: 10px; display: inline-block; margin-bottom: 30px;">
                        ${otp}
                    </div>
                    
                    <p style="color: #95a5a6; font-size: 14px; margin-bottom: 10px;">This OTP will expire in <strong>10 minutes</strong>.</p>
                    <p style="color: #95a5a6; font-size: 14px;">If you didn't request this, please ignore this email.</p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; color: #bdc3c7; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} Food Delivery. All rights reserved.</p>
                </div>
            </div>
        `
    }),

    // Password Reset OTP - NEW
    passwordResetOtp: (otp, name) => ({
        subject: 'Password Reset OTP',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #e74c3c; margin: 0;">Food Delivery</h1>
                </div>
                
                <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px; text-align: center;">
                    <h2 style="color: #2c3e50; margin-bottom: 10px;">Password Reset</h2>
                    <p style="color: #7f8c8d; margin-bottom: 30px;">Hi ${name}, use the OTP below to reset your password.</p>
                    
                    <div style="background-color: #3498db; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px 40px; border-radius: 10px; display: inline-block; margin-bottom: 30px;">
                        ${otp}
                    </div>
                    
                    <p style="color: #95a5a6; font-size: 14px; margin-bottom: 10px;">This OTP will expire in <strong>10 minutes</strong>.</p>
                    <p style="color: #e74c3c; font-size: 14px;">If you didn't request this, please secure your account immediately.</p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; color: #bdc3c7; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} Food Delivery. All rights reserved.</p>
                </div>
            </div>
        `
    }),

    // Welcome Email
    welcome: (name) => ({
        subject: 'Welcome to Food Delivery App!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #e74c3c; margin: 0;">🍔 Food Delivery</h1>
                </div>
                
                <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px;">
                    <h2 style="color: #27ae60; text-align: center;">Welcome, ${name}! 🎉</h2>
                    <p style="color: #7f8c8d; text-align: center; margin-bottom: 30px;">
                        Thank you for joining Food Delivery App. We're excited to have you on board!
                    </p>
                    
                    <div style="text-align: center;">
                        <a href="${process.env.CLIENT_URL}" style="display: inline-block; padding: 15px 30px; background-color: #e74c3c; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Start Ordering 🍕
                        </a>
                    </div>
                </div>
            </div>
        `
    }),

    // Order Confirmation
    orderConfirmation: (order) => ({
        subject: `Order Confirmed - #${order.orderNumber}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #27ae60;">Order Confirmed!</h1>
                <p>Your order #${order.orderNumber} has been confirmed.</p>
                <h3>Order Details:</h3>
                <ul>
                    ${order.items.map(item => `<li>${item.name} x ${item.quantity} - ₹${item.total}</li>`).join('')}
                </ul>
                <p><strong>Total: ₹${order.pricing.total}</strong></p>
                <p>Estimated Delivery: ${order.estimatedDeliveryTime || '30-45 minutes'}</p>
            </div>
        `
    }),

    // Order Status Update
    orderStatusUpdate: (order, status) => ({
        subject: `Order Update - #${order.orderNumber}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #3498db;">Order Status Update</h1>
                <p>Your order #${order.orderNumber} status has been updated to: <strong>${status}</strong></p>
            </div>
        `
    }),

    // Invoice
    invoice: (invoice) => ({
        subject: `Invoice #${invoice.invoiceNumber}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2c3e50;">Invoice #${invoice.invoiceNumber}</h1>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 10px; text-align: left;">Item</th>
                        <th style="padding: 10px; text-align: right;">Amount</th>
                    </tr>
                    ${invoice.items.map(item => `
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${item.name} x ${item.quantity}</td>
                            <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: right;">₹${item.total}</td>
                        </tr>
                    `).join('')}
                    <tr>
                        <td style="padding: 10px;"><strong>Total</strong></td>
                        <td style="padding: 10px; text-align: right;"><strong>₹${invoice.pricing.total}</strong></td>
                    </tr>
                </table>
            </div>
        `
    })
};

export default sendEmail;