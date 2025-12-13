// server.js - FIXED VERSION
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Supabase
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ SUPABASE CONFIG ============
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

console.log('🔧 Environment check:');
console.log('Supabase URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
console.log('Supabase Key:', supabaseKey ? '✓ Set' : '✗ Missing');

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.error('Please check your .env file has SUPABASE_URL and SUPABASE_SECRET_KEY');
    process.exit(1);
}

// Initialize Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// ============ MIDDLEWARE ============
// CORS must come FIRST
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:8080'],
    credentials: true
}));

// JSON parsing middleware MUST come BEFORE routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from current directory
app.use(express.static(__dirname));


// ==================== STATIC FILE SERVING ====================

// Serve main website
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve admin dashboard
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve other static files (CSS, JS)
app.use(express.static(__dirname));

// ==================== END STATIC FILES ====================

// ============ EMAIL TRANSPORTER - FIXED ============
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        // Timeout settings to prevent hanging
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000
    });
    
    // Test connection
    transporter.verify((error, success) => {
        if (error) {
            console.log('❌ Email connection failed:', error.message);
        } else {
            console.log('📧 Email transporter ready');
        }
    });
} else {
    console.log('⚠️  Email credentials not set - email features disabled');
}

// JWT Secret
const JWT_SECRET = process.env.SESSION_SECRET || 'your-secret-key';

// ============ FLUTTERWAVE SETUP ============
const Flutterwave = require('flutterwave-node-v3');
let flw = null;

if (process.env.FLW_PUBLIC_KEY && process.env.FLW_SECRET_KEY) {
    flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
    console.log('💰 Flutterwave initialized');
} else {
    console.log('⚠️  Flutterwave keys not set - payment features disabled');
}

// ============ HELPER FUNCTIONS - FIXED ============
async function sendVerificationEmail(email, code, firstName) {
    return new Promise((resolve, reject) => {
        if (!transporter) {
            console.log('⚠️  No email transporter');
            resolve(); // Don't fail, just skip
            return;
        }

        const mailOptions = {
            from: `Sibo Life Sciences <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verify Your Email - Sibo Life Sciences',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #0066cc;">Welcome to Sibo Life Sciences!</h2>
                    <p>Hello ${firstName},</p>
                    <p>Your verification code is:</p>
                    <div style="background: #f0f8ff; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                        <h1 style="color: #0066cc; margin: 0; font-size: 36px; letter-spacing: 5px;">${code}</h1>
                    </div>
                    <p>Enter this code on the website to verify your email.</p>
                    <p><strong>Code expires in 30 minutes.</strong></p>
                    <br>
                    <p>Best regards,<br>Sibo Life Sciences Team</p>
                </div>
            `,
            text: `Welcome to Sibo Life Sciences!\n\nHello ${firstName},\n\nYour verification code is: ${code}\n\nEnter this code on the website to verify your email.\n\nCode expires in 30 minutes.\n\nBest regards,\nSibo Life Sciences Team`
        };

        // Set timeout to prevent hanging
        const timeout = setTimeout(() => {
            console.log('⏰ Email timeout for:', email);
            reject(new Error('Email timeout after 10 seconds'));
        }, 10000);

        transporter.sendMail(mailOptions, (error, info) => {
            clearTimeout(timeout);
            if (error) {
                console.error('❌ Email send error:', error.message);
                reject(error);
            } else {
                console.log('✅ Email sent to:', email);
                console.log('📧 Message ID:', info.messageId);
                resolve(info);
            }
        });
    });
}

async function sendResetEmail(email, code, firstName) {
    return new Promise((resolve, reject) => {
        if (!transporter) {
            resolve();
            return;
        }

        const mailOptions = {
            from: `Sibo Life Sciences <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Password Reset - Sibo Life Sciences',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #0066cc;">Password Reset</h2>
                    <p>Hello ${firstName},</p>
                    <p>Your password reset code is:</p>
                    <div style="background: #f0f8ff; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                        <h1 style="color: #0066cc; margin: 0; font-size: 36px; letter-spacing: 5px;">${code}</h1>
                    </div>
                    <p>Enter this code on the password reset page.</p>
                    <p><strong>Code expires in 30 minutes.</strong></p>
                    <br>
                    <p>Best regards,<br>Sibo Life Sciences Team</p>
                </div>
            `,
            text: `Password Reset\n\nHello ${firstName},\n\nYour password reset code is: ${code}\n\nEnter this code on the password reset page.\n\nCode expires in 30 minutes.\n\nBest regards,\nSibo Life Sciences Team`
        };

        const timeout = setTimeout(() => {
            reject(new Error('Email timeout'));
        }, 10000);

        transporter.sendMail(mailOptions, (error, info) => {
            clearTimeout(timeout);
            if (error) {
                console.error('Reset email error:', error);
                reject(error);
            } else {
                console.log('✅ Reset email sent to:', email);
                resolve(info);
            }
        });
    });
}

async function sendContactEmail(name, email, subject, message) {
    if (!transporter) return;

    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
            subject: `New Contact: ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #0066cc;">New Contact Form Submission</h2>
                    <p><strong>From:</strong> ${name} (${email})</p>
                    <p><strong>Subject:</strong> ${subject}</p>
                    <div style="background: #f4f4f4; padding: 20px; margin: 20px 0;">
                        <p>${message.replace(/\n/g, '<br>')}</p>
                    </div>
                    <p>Received: ${new Date().toLocaleString()}</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('✅ Contact notification sent');
    } catch (error) {
        console.error('❌ Failed to send contact email:', error);
    }
}

// ============ API ROUTES ============

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        server: 'Sibo Life Sciences API',
        version: '1.0.0',
        email: transporter ? 'Configured' : 'Not configured'
    });
});

// Test Email Endpoint
app.post('/api/test-email', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        console.log('🧪 Testing email to:', email);
        
        const testCode = '123456';
        await sendVerificationEmail(email, testCode, 'Test User');
        
        res.json({
            success: true,
            message: 'Test email sent successfully! Check your inbox.',
            email: email
        });
    } catch (error) {
        console.error('Test email error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to send test email: ' + error.message 
        });
    }
});

// ============ AUTH ROUTES ============

// Register User - FIXED VERSION
app.post('/api/register', async (req, res) => {
    console.log('🚀 REGISTER ENDPOINT CALLED');
    
    try {
        const { email, password, firstName, lastName, phone } = req.body;

        console.log('📝 Registration attempt:', { email, firstName });

        // Validation
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user exists
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        // Handle "not found" error gracefully
        if (checkError && checkError.code !== 'PGRST116') {
            console.error('❌ Supabase check error:', checkError);
            return res.status(500).json({ error: 'Database error checking user' });
        }

        if (existingUser) {
            if (!existingUser.email_verified) {
                const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
                
                // Store code
                await supabase
                    .from('verification_codes')
                    .upsert({
                        email: email,
                        code: verificationCode,
                        expires_at: new Date(Date.now() + 30 * 60 * 1000),
                        type: 'email_verification'
                    });

                // Send email without blocking
                sendVerificationEmail(email, verificationCode, firstName)
                    .then(() => console.log('📧 Resent verification to:', email))
                    .catch(err => console.error('📧 Email error:', err));

                return res.json({
                    success: true,
                    message: 'New verification code sent',
                    email: email
                });
            }
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const { data: user, error: userError } = await supabase
            .from('users')
            .insert({
                email: email,
                password: hashedPassword,
                first_name: firstName,
                last_name: lastName,
                phone: phone || null,
                email_verified: false
            })
            .select()
            .single();

        if (userError) {
            console.error('❌ Supabase error:', userError);
            return res.status(500).json({ error: 'Failed to create user' });
        }

        console.log('✅ User created:', user.id);

        // Generate verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store code
        await supabase
            .from('verification_codes')
            .insert({
                email: email,
                code: verificationCode,
                expires_at: new Date(Date.now() + 30 * 60 * 1000),
                type: 'email_verification'
            });

        console.log('📧 Generated code:', verificationCode);
        console.log('📧 Attempting to send email...');

        // ✅ CRITICAL FIX: Send email async without blocking
        sendVerificationEmail(email, verificationCode, firstName)
            .then(() => {
                console.log('✅ Email sent successfully to:', email);
            })
            .catch((emailError) => {
                console.error('❌ Email failed:', emailError.message);
                // Log the code for manual verification if needed
                console.log('⚠️  Manual verification code:', verificationCode);
            });

        // Respond immediately - don't wait for email
        res.status(201).json({
            success: true,
            message: 'Registration successful! Check your email for verification code.',
            email: email,
            needsVerification: true
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// Login User
app.post('/api/login', async (req, res) => {
    console.log('🔐 LOGIN ENDPOINT HIT');
    
    try {
        const { email, password } = req.body;

        console.log('🔐 Login attempt:', email);

        // Find user
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check verification
        if (!user.email_verified) {
            console.log('⚠️  User not verified:', email);
            return res.status(403).json({ 
                error: 'Please verify your email first. Check your email for verification code.' 
            });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Update last login
        await supabase
            .from('users')
            .update({ last_login: new Date() })
            .eq('id', user.id);

        console.log('✅ Login successful:', email);
        
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                email_verified: user.email_verified
            },
            token: token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify Email
app.post('/api/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body;

        console.log('🔑 Verification attempt:', email);

        // Find code
        const { data: verification } = await supabase
            .from('verification_codes')
            .select('*')
            .eq('email', email)
            .eq('code', code)
            .eq('type', 'email_verification')
            .gt('expires_at', new Date().toISOString())
            .single();

        if (!verification) {
            return res.status(400).json({ error: 'Invalid or expired code' });
        }

        // Verify user
        const { error: updateError } = await supabase
            .from('users')
            .update({ email_verified: true })
            .eq('email', email);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to verify email' });
        }

        // Delete code
        await supabase
            .from('verification_codes')
            .delete()
            .eq('email', email)
            .eq('type', 'email_verification');

        res.json({
            success: true,
            message: 'Email verified successfully!'
        });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Resend Verification
app.post('/api/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.email_verified) return res.status(400).json({ error: 'Already verified' });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        await supabase
            .from('verification_codes')
            .upsert({
                email: email,
                code: code,
                expires_at: new Date(Date.now() + 30 * 60 * 1000),
                type: 'email_verification'
            });

        // Send async
        sendVerificationEmail(email, code, user.first_name)
            .then(() => console.log('📧 Resent verification'))
            .catch(err => console.error('📧 Email error:', err));

        res.json({
            success: true,
            message: 'New verification code sent'
        });

    } catch (error) {
        console.error('Resend error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Forgot Password
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (!user) return res.status(404).json({ error: 'User not found' });

        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        await supabase
            .from('verification_codes')
            .upsert({
                email: email,
                code: resetCode,
                expires_at: new Date(Date.now() + 30 * 60 * 1000),
                type: 'password_reset'
            });

        // Send async
        sendResetEmail(email, resetCode, user.first_name)
            .then(() => console.log('📧 Reset email sent'))
            .catch(err => console.error('📧 Email error:', err));

        res.json({
            success: true,
            message: 'Reset code sent to your email'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify Reset Code
app.post('/api/verify-reset-code', async (req, res) => {
    try {
        const { email, code } = req.body;

        const { data: resetCode } = await supabase
            .from('verification_codes')
            .select('*')
            .eq('email', email)
            .eq('code', code)
            .eq('type', 'password_reset')
            .gt('expires_at', new Date().toISOString())
            .single();

        if (!resetCode) {
            return res.status(400).json({ error: 'Invalid or expired code' });
        }

        res.json({
            success: true,
            message: 'Code verified'
        });

    } catch (error) {
        console.error('Verify reset error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset Password
app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        // Verify code
        const { data: resetCode } = await supabase
            .from('verification_codes')
            .select('*')
            .eq('email', email)
            .eq('code', code)
            .eq('type', 'password_reset')
            .gt('expires_at', new Date().toISOString())
            .single();

        if (!resetCode) {
            return res.status(400).json({ error: 'Invalid or expired code' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('email', email);

        // Delete code
        await supabase
            .from('verification_codes')
            .delete()
            .eq('email', email)
            .eq('type', 'password_reset');

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get User Profile
app.get('/api/user/profile', async (req, res) => {
    try {
        const userId = req.query.userId;

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { password, ...userWithoutPassword } = user;

        res.json({
            success: true,
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update User Profile
app.put('/api/user/profile', async (req, res) => {
    try {
        const { userId, firstName, lastName, phone } = req.body;

        const { data: user, error } = await supabase
            .from('users')
            .update({
                first_name: firstName,
                last_name: lastName,
                phone: phone,
                updated_at: new Date()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to update profile' });
        }

        const { password, ...userWithoutPassword } = user;

        res.json({
            success: true,
            message: 'Profile updated',
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ PRODUCTS & ORDERS ============

// Get all products
app.get('/api/products', async (req, res) => {
    try {
        console.log('📦 Fetching products from database...');
        
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Products fetch error:', error);
            return res.status(500).json({ 
                success: false,
                error: 'Failed to fetch products from database' 
            });
        }

        console.log(`✅ Found ${products?.length || 0} products`);
        
        res.json({
            success: true,
            products: products || []
        });

    } catch (error) {
        console.error('❌ Products endpoint error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error: ' + error.message 
        });
    }
});

// Create Order
app.post('/api/orders', async (req, res) => {
    try {
        const { userId, items, total, paymentMethod, deliveryAddress, mpesaPhone } = req.body;

        const { data: order, error } = await supabase
            .from('orders')
            .insert({
                user_id: userId,
                items: JSON.stringify(items),
                total_amount: total,
                payment_method: paymentMethod,
                delivery_address: deliveryAddress,
                mpesa_phone: mpesaPhone,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            console.error('Create order error:', error);
            return res.status(500).json({ error: 'Failed to create order' });
        }

        res.json({
            success: true,
            message: 'Order created',
            order: order
        });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get User Orders
app.get('/api/user/orders', async (req, res) => {
    try {
        const userId = req.query.userId;

        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch orders' });
        }

        res.json({
            success: true,
            orders: orders || []
        });

    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Contact Form
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        console.log('📧 Contact form:', { name, email, subject });

        // Save to database
        const { data: contact, error } = await supabase
            .from('contact_messages')
            .insert({
                name: name,
                email: email,
                subject: subject,
                message: message
            })
            .select()
            .single();

        if (error) {
            console.error('Database error:', error);
        }

        // Send email notification
        if (transporter) {
            try {
                await sendContactEmail(name, email, subject, message);
            } catch (emailError) {
                console.error('Email error:', emailError);
            }
        }

        res.json({
            success: true,
            message: 'Thank you for contacting us! We will get back to you soon.'
        });

    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// ============ PAYMENT ROUTES ============
// (Keep your existing payment routes here)
// ...

// ============ ADMIN ROUTES ============
// (Keep your existing admin routes here)
// ...

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`🚀 Sibo Life Sciences Server`);
    console.log('='.repeat(60));
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📧 Email: ${transporter ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`🗄️  Supabase: ${supabaseUrl ? '✅ Connected' : '❌ Not connected'}`);
    console.log('='.repeat(60));
    console.log('\n📋 Test Endpoints:');
    console.log(`   POST /api/test-email      - Test email sending`);
    console.log(`   POST /api/register        - Register user`);
    console.log(`   POST /api/verify-email    - Verify email`);
    console.log('='.repeat(60));
});
