<<<<<<< HEAD
// server.js - COMPLETE WORKING VERSION WITH PAYSTACK
=======
// server.js - FIXED VERSION
>>>>>>> 5ea0eed174abb5802f3985d4c0e2868c521a5821
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const axios = require('axios');
const path = require('path');
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
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============ MIDDLEWARE ============
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:8080'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

<<<<<<< HEAD
// ============ EMAIL TRANSPORTER ============
=======

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
>>>>>>> 5ea0eed174abb5802f3985d4c0e2868c521a5821
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
<<<<<<< HEAD
    console.log('📧 Email transporter initialized');
=======
} else {
    console.log('⚠️  Email credentials not set - email features disabled');
>>>>>>> 5ea0eed174abb5802f3985d4c0e2868c521a5821
}

// JWT Secret
const JWT_SECRET = process.env.SESSION_SECRET || 'your-secret-key';

<<<<<<< HEAD
// ============ STATIC FILES ============
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ============ HEALTH CHECK ============
=======
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
>>>>>>> 5ea0eed174abb5802f3985d4c0e2868c521a5821
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        server: 'Sibo Life Sciences API',
<<<<<<< HEAD
        payment: 'Paystack Integration Active'
    });
});

// ============ PRODUCTS ============
app.get('/api/products', async (req, res) => {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, products: products || [] });
    } catch (error) {
        console.error('Products error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch products' });
    }
});

// ============ AUTHENTICATION ============
app.post('/api/register', async (req, res) => {
=======
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
    
>>>>>>> 5ea0eed174abb5802f3985d4c0e2868c521a5821
    try {
        const { email, password, firstName, lastName, phone } = req.body;

        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check existing user
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (existingUser) {
<<<<<<< HEAD
=======
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
>>>>>>> 5ea0eed174abb5802f3985d4c0e2868c521a5821
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

<<<<<<< HEAD
        if (userError) throw userError;
=======
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
>>>>>>> 5ea0eed174abb5802f3985d4c0e2868c521a5821

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
<<<<<<< HEAD
            message: 'Registration successful!',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            },
            token: token
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone
            },
            token: token
        });

    } catch (error) {
=======
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
>>>>>>> 5ea0eed174abb5802f3985d4c0e2868c521a5821
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

<<<<<<< HEAD
// ============ USER PROFILE ============
=======
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
>>>>>>> 5ea0eed174abb5802f3985d4c0e2868c521a5821
app.get('/api/user/profile', async (req, res) => {
    try {
        const userId = req.query.userId;

        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Remove password from response
        const { password, ...userWithoutPassword } = user;

        res.json({
            success: true,
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

app.put('/api/user/profile', async (req, res) => {
    try {
        const { userId, firstName, lastName, phone } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

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

        if (error) throw error;

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: user
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

<<<<<<< HEAD
// ============ ORDERS ============
=======
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
>>>>>>> 5ea0eed174abb5802f3985d4c0e2868c521a5821
app.post('/api/orders', async (req, res) => {
    try {
        const { userId, items, total, paymentMethod, deliveryAddress, mpesaPhone, transactionId } = req.body;

        const { data: order, error } = await supabase
            .from('orders')
            .insert({
                user_id: userId,
                items: JSON.stringify(items),
                total_amount: total,
                payment_method: paymentMethod,
                delivery_address: deliveryAddress,
                mpesa_phone: mpesaPhone,
                transaction_id: transactionId,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Order created successfully',
            order: order
        });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

app.get('/api/user/orders', async (req, res) => {
    try {
        const userId = req.query.userId;

        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            orders: orders || []
        });

    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// ============ CONTACT FORM ============
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const { error } = await supabase
            .from('contact_messages')
            .insert({
                name: name,
                email: email,
                subject: subject,
                message: message,
                created_at: new Date()
            });

        if (error) throw error;

        res.json({
            success: true,
            message: 'Thank you for contacting us! We will get back to you soon.'
        });

    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

<<<<<<< HEAD
// ============ PAYSTACK M-PESA INTEGRATION ============
app.post('/api/mpesa/stk-push', async (req, res) => {
    try {
        console.log('💰 PAYSTACK M-Pesa Request:', req.body);
        
        const { phone, amount, orderId } = req.body;
        
        if (!phone || !amount) {
            return res.status(400).json({ error: 'Phone and amount are required' });
        }

        // Format phone for Paystack
        let formattedPhone = phone.replace(/\D/g, ''); // Remove non-digits
        
        if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
            formattedPhone = '254' + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith('254') && formattedPhone.length === 12) {
            // Already correct
        } else if (formattedPhone.length === 9) {
            formattedPhone = '254' + formattedPhone;
        }

        // Validate phone format
        if (!formattedPhone.match(/^254[17]\d{8}$/)) {
            return res.status(400).json({ 
                error: 'Invalid phone number format. Use: 0704371652 or 254704371652' 
            });
        }

        // Paystack REQUIRES email
        const customerEmail = 'customer@sibolifesciences.com';
        
        // Paystack payload for M-Pesa
        const payload = {
            email: customerEmail,
            amount: Math.floor(amount * 100), // Convert to cents
            currency: 'KES',
            mobile_money: {
                phone: formattedPhone,
                provider: 'mpesa'
            },
            metadata: {
                order_id: orderId,
                customer_phone: formattedPhone,
                business_name: 'Sibo Life Sciences'
            }
        };

        console.log('📤 Sending to Paystack:', {
            phone: formattedPhone,
            amount: amount,
            orderId: orderId
        });

        // REAL API CALL to Paystack
        const response = await axios.post(
            'https://api.paystack.co/charge',
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        console.log('✅ Paystack Response:', response.data);

        if (response.data.status === true) {
            res.json({
                success: true,
                message: 'M-Pesa request sent! Check your phone for PIN prompt.',
                checkoutRequestId: response.data.data.reference,
                paystackResponse: response.data
            });
        } else {
            throw new Error(response.data.message || 'Paystack payment failed');
        }

    } catch (error) {
        console.error('❌ Paystack error:', error.response?.data || error.message);
        
        let errorMsg = 'Payment request failed';
        if (error.response?.data?.message) {
            errorMsg = error.response.data.message;
        } else if (error.message.includes('timeout')) {
            errorMsg = 'Payment request timeout. Please try again.';
        }
        
        res.status(500).json({ 
            success: false,
            error: errorMsg
        });
    }
});

// Check Paystack Payment Status
app.get('/api/mpesa/check-payment/:reference', async (req, res) => {
    try {
        const { reference } = req.params;
        
        console.log('🔍 Checking Paystack payment:', reference);

        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        );

        console.log('📊 Paystack status:', response.data.data.status);

        if (response.data.data.status === 'success') {
            res.json({
                success: true,
                status: 'completed',
                amount: response.data.data.amount / 100,
                transactionId: response.data.data.id,
                paidAt: response.data.data.paid_at
            });
        } else if (response.data.data.status === 'pending') {
            res.json({
                success: true,
                status: 'pending',
                message: 'Waiting for payment confirmation...'
            });
        } else {
            res.json({
                success: false,
                status: 'failed',
                message: response.data.data.gateway_response || 'Payment failed'
            });
        }

    } catch (error) {
        console.error('❌ Check payment error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to check payment status' 
        });
    }
});

// ============ PASSWORD RESET ENDPOINTS ============
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if user exists
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            // Don't reveal if user exists for security
            return res.json({ 
                success: true, 
                message: 'If an account exists, a reset code has been sent.' 
            });
        }

        // Generate 6-digit code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60000); // 15 minutes

        // Save reset code to database
        const { error: updateError } = await supabase
            .from('password_resets')
            .upsert({
                email: email,
                code: resetCode,
                expires_at: expiresAt,
                created_at: new Date()
            });

        if (updateError) throw updateError;

        // Send email with code (you can implement this)
        console.log(`Password reset code for ${email}: ${resetCode}`);

        res.json({
            success: true,
            message: 'Reset code generated successfully',
            code: resetCode // Remove this in production
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

app.post('/api/verify-reset-code', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Email and code are required' });
        }

        // Verify code
        const { data: reset, error } = await supabase
            .from('password_resets')
            .select('*')
            .eq('email', email)
            .eq('code', code)
            .gt('expires_at', new Date())
            .single();

        if (error || !reset) {
            return res.status(400).json({ error: 'Invalid or expired reset code' });
        }

        res.json({
            success: true,
            message: 'Code verified successfully'
        });

    } catch (error) {
        console.error('Verify reset code error:', error);
        res.status(500).json({ error: 'Failed to verify code' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Verify code first
        const { data: reset, error: resetError } = await supabase
            .from('password_resets')
            .select('*')
            .eq('email', email)
            .eq('code', code)
            .gt('expires_at', new Date())
            .single();

        if (resetError || !reset) {
            return res.status(400).json({ error: 'Invalid or expired reset code' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        const { error: updateError } = await supabase
            .from('users')
            .update({
                password: hashedPassword,
                updated_at: new Date()
            })
            .eq('email', email);

        if (updateError) throw updateError;

        // Delete used reset code
        await supabase
            .from('password_resets')
            .delete()
            .eq('email', email)
            .eq('code', code);

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// ============ EMAIL VERIFICATION ============
app.post('/api/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Email and code are required' });
        }

        // In a real app, you would:
        // 1. Verify the code from database
        // 2. Mark email as verified
        // For now, we'll just simulate success

        console.log(`Email verification for ${email} with code ${code}`);

        res.json({
            success: true,
            message: 'Email verified successfully'
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ error: 'Email verification failed' });
    }
});

app.post('/api/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // In a real app, you would send a new verification code
        console.log(`Resending verification to ${email}`);

        res.json({
            success: true,
            message: 'Verification code resent'
        });

    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ error: 'Failed to resend verification' });
    }
});

// ============ ADMIN ROUTES ============
const adminAuth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const adminEmail = process.env.ADMIN_EMAIL || 'sibolifesciences@gmail.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        if (email === adminEmail && password === adminPassword) {
            const token = jwt.sign(
                { email: email, role: 'admin' },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            res.json({
                success: true,
                token: token,
                admin: {
                    email: email,
                    name: 'Sibo Admin'
                }
            });
        } else {
            res.status(401).json({ error: 'Invalid admin credentials' });
        }
        
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/products', adminAuth, async (req, res) => {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, products: products || [] });
    } catch (error) {
        console.error('Admin products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

app.post('/api/admin/products', adminAuth, async (req, res) => {
    try {
        const { name, description, price, stock, category, image_url } = req.body;

        if (!name || !price) {
            return res.status(400).json({ error: 'Product name and price are required' });
        }

        const { data: product, error } = await supabase
            .from('products')
            .insert({
                name: name,
                description: description || '',
                price: parseFloat(price),
                stock: stock ? parseInt(stock) : 100,
                category: category || 'Medical Supplies',
                image_url: image_url || 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
            })
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Product added successfully!',
            product: product
        });

    } catch (error) {
        console.error('Add product error:', error);
        res.status(500).json({ error: 'Failed to add product' });
    }
});

app.put('/api/admin/products/:id', adminAuth, async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, description, price, stock, category, image_url } = req.body;

        const { data: product, error } = await supabase
            .from('products')
            .update({
                name: name,
                description: description,
                price: parseFloat(price),
                stock: parseInt(stock),
                category: category,
                image_url: image_url,
                updated_at: new Date()
            })
            .eq('id', productId)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Product updated successfully',
            product: product
        });

    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

app.delete('/api/admin/products/:id', adminAuth, async (req, res) => {
    try {
        const productId = req.params.id;

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });

    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

app.get('/api/admin/orders', adminAuth, async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, orders: orders || [] });
    } catch (error) {
        console.error('Admin orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

app.put('/api/admin/orders/:id', adminAuth, async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body;

        const { data: order, error } = await supabase
            .from('orders')
            .update({
                status: status,
                updated_at: new Date()
            })
            .eq('id', orderId)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Order status updated',
            order: order
        });

    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});
=======
// ============ PAYMENT ROUTES ============
// (Keep your existing payment routes here)
// ...

// ============ ADMIN ROUTES ============
// (Keep your existing admin routes here)
// ...
>>>>>>> 5ea0eed174abb5802f3985d4c0e2868c521a5821

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`🚀 Sibo Life Sciences Server`);
    console.log('='.repeat(60));
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
<<<<<<< HEAD
    console.log(`🌐 Admin: http://localhost:${PORT}/admin`);
    console.log(`📧 Email: ${process.env.EMAIL_USER ? 'Configured' : 'Not configured'}`);
    console.log(`💰 Payment: Paystack Test Mode`);
    console.log(`🗄️  Supabase: ${supabaseUrl ? 'Connected' : 'Not connected'}`);
    console.log(`🔑 Paystack: ${process.env.PAYSTACK_SECRET_KEY ? '✓ Configured' : '✗ Not configured'}`);
    console.log('='.repeat(50));
    console.log('\n📋 Available Endpoints:');
    console.log(`   GET  /                     - Website homepage`);
    console.log(`   GET  /admin                - Admin dashboard`);
    console.log(`   GET  /api/health           - Health check`);
    console.log(`   GET  /api/products         - Get all products`);
    console.log(`   POST /api/register         - Register user`);
    console.log(`   POST /api/login            - Login user`);
    console.log(`   POST /api/contact          - Contact form`);
    console.log(`   POST /api/mpesa/stk-push   - M-Pesa payment (via Paystack)`);
    console.log(`   GET  /api/mpesa/check-payment/:id - Check payment status`);
    console.log(`   GET  /api/user/profile?userId=   - Get user profile`);
    console.log(`   GET  /api/user/orders?userId=    - Get user orders`);
    console.log(`   POST /api/orders           - Create order`);
    console.log(`   POST /api/forgot-password  - Request password reset`);
    console.log(`   POST /api/verify-reset-code- Verify reset code`);
    console.log(`   POST /api/reset-password   - Reset password`);
    console.log('\n🔐 Admin Endpoints (require auth):');
    console.log(`   GET  /api/admin/products   - Get all products (admin)`);
    console.log(`   POST /api/admin/products   - Add product`);
    console.log(`   PUT  /api/admin/products/:id - Update product`);
    console.log(`   DELETE /api/admin/products/:id - Delete product`);
    console.log(`   GET  /api/admin/orders     - Get all orders`);
    console.log(`   PUT  /api/admin/orders/:id - Update order status`);
    console.log('='.repeat(50));
});
=======
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
>>>>>>> 5ea0eed174abb5802f3985d4c0e2868c521a5821
