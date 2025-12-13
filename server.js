// server.js - COMPLETE FIXED VERSION
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

// Your existing API routes stay BELOW this
// app.post('/api/orders', ... etc.

// ============ EMAIL TRANSPORTER ============
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    console.log('📧 Email transporter initialized');
} else {
    console.log('⚠️  Email credentials not set - email features disabled');
}

// JWT Secret
const JWT_SECRET = process.env.SESSION_SECRET || 'your-secret-key';

// ============ FLUTTERWAVE SETUP ============  ← ADD THIS SECTION
const Flutterwave = require('flutterwave-node-v3');
let flw = null; // Initialize as null first

// Check if Flutterwave keys exist before initializing
if (process.env.FLW_PUBLIC_KEY && process.env.FLW_SECRET_KEY) {
    flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
    console.log('💰 Flutterwave initialized');
} else {
    console.log('⚠️  Flutterwave keys not set - payment features disabled');
}

// ============ API ROUTES ============
const darajaService = require('./darajaService');

// ==================== M-PESA CALLBACK ENDPOINTS ====================

// 1. Validation URL (Safaricom checks this during registration)
app.get('/api/mpesa/validate', (req, res) => {
    console.log('🔐 M-Pesa Validation Request:', req.query);
    
    // Return ACCEPTED response to Safaricom
    res.json({
        "ResultCode": 0,
        "ResultDesc": "Accepted"
    });
});

// 2. Confirmation/Callback URL (Safaricom sends payment updates here)
app.post('/api/mpesa/callback', (req, res) => {
    console.log('📞 M-Pesa Callback Received:', JSON.stringify(req.body, null, 2));
    
    try {
        const callbackData = req.body;
        
        // Check if payment was successful
        if (callbackData.Body?.stkCallback?.ResultCode === 0) {
            // Payment successful
            const metadata = callbackData.Body.stkCallback.CallbackMetadata?.Item || [];
            
            const receipt = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
            const phone = metadata.find(item => item.Name === 'PhoneNumber')?.Value;
            const amount = metadata.find(item => item.Name === 'Amount')?.Value;
            
            console.log('✅ Payment Successful:', { receipt, phone, amount });
            
            // TODO: Update your database here
            // Mark order as paid, send confirmation, etc.
            
        } else {
            // Payment failed
            const errorMsg = callbackData.Body?.stkCallback?.ResultDesc || 'Payment failed';
            console.log('❌ Payment Failed:', errorMsg);
        }
        
        // Always return success to Safaricom
        res.json({
            "ResultCode": 0,
            "ResultDesc": "Success"
        });
        
    } catch (error) {
        console.error('Callback processing error:', error);
        res.json({
            "ResultCode": 1,
            "ResultDesc": "Error"
        });
    }
});

// ==================== END M-PESA CALLBACKS ====================

// STK Push endpoint
app.post('/api/mpesa/stk-push', async (req, res) => {
    try {
        const { phone, amount, orderId, accountReference } = req.body;
        
        console.log('📱 STK Push request:', req.body);
        
        if (!phone || !amount || !orderId) {
            return res.status(400).json({
                success: false,
                error: 'Missing phone, amount, or orderId'
            });
        }

        const result = await darajaService.sendSTKPush(
            phone, 
            amount, 
            orderId,
            accountReference || 'SIBO-LIFE'
        );

        if (result.success) {
            res.json({
                success: true,
                checkoutRequestId: result.checkoutRequestID,
                merchantRequestId: result.merchantRequestID,
                message: result.customerMessage
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error || 'Failed to send STK Push'
            });
        }
    } catch (error) {
        console.error('STK Push endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Check payment status endpoint
app.get('/api/mpesa/check-payment/:checkoutRequestId', async (req, res) => {
    try {
        const { checkoutRequestId } = req.params;
        
        if (!checkoutRequestId) {
            return res.status(400).json({
                success: false,
                error: 'Missing checkoutRequestId'
            });
        }

        const result = await darajaService.checkPaymentStatus(checkoutRequestId);
        
        res.json(result);
    } catch (error) {
        console.error('Check payment error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// M-Pesa callback (Safaricom sends payment updates here)
app.post('/api/mpesa/callback', (req, res) => {
    console.log('📞 M-Pesa Callback:', JSON.stringify(req.body, null, 2));
    
    // Always respond success to Safaricom
    res.json({
        ResultCode: 0,
        ResultDesc: 'Success'
    });
});
// ============ ADMIN ROUTES ============
// ============ ADMIN ROUTES ============

// Simple admin authentication (temporary)
const adminAuth = (req, res, next) => {
    // For now, accept all requests to admin routes
    // In production, add proper JWT authentication
    next();
};

// Admin login (simple version)
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Simple hardcoded admin for now
        const adminEmail = process.env.ADMIN_EMAIL || 'sibolifesciences@gmail.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        if (email === adminEmail && password === adminPassword) {
            res.json({
                success: true,
                token: 'admin-token-123', // Simple token for now
                admin: {
                    email: email,
                    name: 'Admin User'
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

// Get all products (Admin)
app.get('/api/admin/products', adminAuth, async (req, res) => {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Admin products error:', error);
            return res.status(500).json({ error: 'Failed to fetch products' });
        }

        res.json({
            success: true,
            products: products || []
        });
    } catch (error) {
        console.error('Admin products error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new product
app.post('/api/admin/products', adminAuth, async (req, res) => {
    console.log('📦 Admin adding product:', req.body);
    
    try {
        const { name, description, price, stock, category, image_url } = req.body;

        // Validation
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

        if (error) {
            console.error('Add product error:', error);
            return res.status(500).json({ error: 'Failed to add product: ' + error.message });
        }

        console.log('✅ Product added:', product);
        
        res.json({
            success: true,
            message: 'Product added successfully!',
            product: product
        });

    } catch (error) {
        console.error('Add product error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Update product
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

        if (error) {
            console.error('Update product error:', error);
            return res.status(500).json({ error: 'Failed to update product' });
        }

        res.json({
            success: true,
            message: 'Product updated successfully',
            product: product
        });

    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete product
app.delete('/api/admin/products/:id', adminAuth, async (req, res) => {
    try {
        const productId = req.params.id;

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId);

        if (error) {
            console.error('Delete product error:', error);
            return res.status(500).json({ error: 'Failed to delete product' });
        }

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });

    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all orders (Admin)
app.get('/api/admin/orders', adminAuth, async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Admin orders error:', error);
            return res.status(500).json({ error: 'Failed to fetch orders' });
        }

        res.json({
            success: true,
            orders: orders || []
        });
    } catch (error) {
        console.error('Admin orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update order status
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

        if (error) {
            console.error('Update order error:', error);
            return res.status(500).json({ error: 'Failed to update order' });
        }

        res.json({
            success: true,
            message: 'Order status updated',
            order: order
        });

    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all products for main website
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
// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: admin, error } = await supabase
            .from('admin_users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !admin) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        // Check password (simplified - in production use bcrypt)
        const isValidPassword = password === 'admin123'; // Temporary
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        // Generate admin token
        const token = jwt.sign(
            { adminId: admin.id, email: admin.email, role: admin.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            admin: {
                id: admin.id,
                email: admin.email,
                fullName: admin.full_name,
                role: admin.role
            },
            token: token
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all products (Admin)
app.get('/api/admin/products', async (req, res) => {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Admin products error:', error);
            return res.status(500).json({ error: 'Failed to fetch products' });
        }

        res.json({
            success: true,
            products: products || []
        });
    } catch (error) {
        console.error('Admin products error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new product
app.post('/api/admin/products', async (req, res) => {
    try {
        const { name, description, price, image_url, category, stock } = req.body;

        if (!name || !price) {
            return res.status(400).json({ error: 'Name and price are required' });
        }

        const { data: product, error } = await supabase
            .from('products')
            .insert({
                name: name,
                description: description || '',
                price: parseFloat(price),
                image_url: image_url || 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
                category: category || 'Medical Supplies',
                stock: stock || 100
            })
            .select()
            .single();

        if (error) {
            console.error('Add product error:', error);
            return res.status(500).json({ error: 'Failed to add product' });
        }

        res.json({
            success: true,
            message: 'Product added successfully',
            product: product
        });

    } catch (error) {
        console.error('Add product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update product
app.put('/api/admin/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, description, price, image_url, category, stock } = req.body;

        const { data: product, error } = await supabase
            .from('products')
            .update({
                name: name,
                description: description,
                price: parseFloat(price),
                image_url: image_url,
                category: category,
                stock: stock,
                updated_at: new Date()
            })
            .eq('id', productId)
            .select()
            .single();

        if (error) {
            console.error('Update product error:', error);
            return res.status(500).json({ error: 'Failed to update product' });
        }

        res.json({
            success: true,
            message: 'Product updated successfully',
            product: product
        });

    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete product
app.delete('/api/admin/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId);

        if (error) {
            console.error('Delete product error:', error);
            return res.status(500).json({ error: 'Failed to delete product' });
        }

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });

    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all orders (Admin)
app.get('/api/admin/orders', async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                users:user_id (email, first_name, last_name, phone)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Admin orders error:', error);
            return res.status(500).json({ error: 'Failed to fetch orders' });
        }

        res.json({
            success: true,
            orders: orders || []
        });
    } catch (error) {
        console.error('Admin orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update order status
app.put('/api/admin/orders/:id', async (req, res) => {
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

        if (error) {
            console.error('Update order error:', error);
            return res.status(500).json({ error: 'Failed to update order' });
        }

        res.json({
            success: true,
            message: 'Order status updated',
            order: order
        });

    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        server: 'Sibo Life Sciences API',
        version: '1.0.0'
    });
});

// Test Endpoint
app.post('/api/test-register', (req, res) => {
    console.log('🧪 TEST ENDPOINT - Body:', req.body);
    console.log('🧪 TEST ENDPOINT - Headers:', req.headers);
    res.json({ 
        message: 'Test successful',
        body: req.body,
        headers: req.headers 
    });
});

// Register User - FIXED VERSION
app.post('/api/register', async (req, res) => {
    // DEBUG LOGS
    console.log('🚨 REGISTER ENDPOINT HIT!');
    console.log('Request Body:', req.body);
    console.log('Body type:', typeof req.body);
    console.log('Content-Type header:', req.headers['content-type']);
    
    // Check if body exists
    if (!req.body || Object.keys(req.body).length === 0) {
        console.error('❌ ERROR: req.body is empty!');
        return res.status(400).json({ 
            error: 'No data received. Please check your form submission.' 
        });
    }
    
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

                // Send email if transporter exists
                if (transporter) {
                    await sendVerificationEmail(email, verificationCode, firstName);
                }

                return res.status(200).json({
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
            console.error('Supabase error:', userError);
            return res.status(500).json({ error: 'Failed to create user' });
        }

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

        // Send email
        if (transporter) {
            await sendVerificationEmail(email, verificationCode, firstName);
        }

        // Generate token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            message: 'Registration successful! Check your email for verification code.',
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
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Login User
app.post('/api/login', async (req, res) => {
    // DEBUG LOGS
    console.log('🔐 LOGIN ENDPOINT HIT');
    console.log('Request Body:', req.body);
    
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

        if (transporter) {
            await sendVerificationEmail(email, code, user.first_name);
        }

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

        if (transporter) {
            await sendResetEmail(email, resetCode, user.first_name);
        }

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

// ============ REAL PAYSTACK MPESA INTEGRATION ============

app.post('/api/mpesa/stk-push', async (req, res) => {
    try {
        console.log('💰 PAYSTACK M-Pesa Request:', req.body);
        
        const { phone, amount, orderId } = req.body;
        
        // Format phone for Paystack (07XXXXXXXX)
        const formattedPhone = phone.replace(/^(?:254|\+254|0)?(7\d{8})$/, '0$1');
        
        if (!formattedPhone.match(/^07\d{8}$/)) {
            return res.status(400).json({ 
                error: 'Invalid phone. Use: 2547XXXXXXXX, 07XXXXXXXX, or +2547XXXXXXXX' 
            });
        }

        // Paystack REQUIRES email
        const customerEmail = 'customer@sibolifesciences.com'; // Get from your form
        
        // Paystack payload
        const payload = {
            email: customerEmail,
            amount: Math.floor(amount * 100), // Paystack uses kobo (amount * 100)
            currency: 'KES',
            mobile_money: {
                phone: formattedPhone,
                provider: 'mpesa'
            },
            metadata: {
                order_id: orderId,
                customer_phone: phone
            }
        };

        console.log('📤 Sending to Paystack:', payload);

        // REAL API CALL to Paystack
        const response = await axios.post(
            'https://api.paystack.co/charge',
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Paystack Response:', response.data);

        if (response.data.status === true) {
            // Payment initiated successfully
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
        res.status(500).json({ 
            error: 'Payment failed: ' + (error.response?.data?.message || error.message)
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
                currency: response.data.data.currency,
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
        res.status(500).json({ error: 'Failed to check payment status' });
    }
});

// STK Push endpoint
app.post('/api/mpesa/stk-push', async (req, res) => {
    try {
        const { phone, amount, orderId, accountReference } = req.body;
        
        console.log('📱 STK Push request:', req.body);
        
        if (!phone || !amount || !orderId) {
            return res.status(400).json({
                success: false,
                error: 'Missing phone, amount, or orderId'
            });
        }

        const result = await darajaService.sendSTKPush(
            phone, 
            amount, 
            orderId,
            accountReference || 'SIBO-LIFE'
        );

        if (result.success) {
            res.json({
                success: true,
                checkoutRequestId: result.checkoutRequestID,
                merchantRequestId: result.merchantRequestID,
                message: result.customerMessage
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error || 'Failed to send STK Push'
            });
        }
    } catch (error) {
        console.error('STK Push endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Check payment status
app.get('/api/mpesa/check-payment/:checkoutRequestId', async (req, res) => {
    try {
        const { checkoutRequestId } = req.params;
        
        if (!checkoutRequestId) {
            return res.status(400).json({
                success: false,
                error: 'Missing checkoutRequestId'
            });
        }

        const result = await darajaService.checkPaymentStatus(checkoutRequestId);
        
        res.json(result);
    } catch (error) {
        console.error('Check payment error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// M-Pesa callback (Safaricom sends payment updates here)
app.post('/api/mpesa/callback', (req, res) => {
    console.log('📞 M-Pesa Callback:', JSON.stringify(req.body, null, 2));
    
    // Always respond success to Safaricom
    res.json({
        ResultCode: 0,
        ResultDesc: 'Success'
    });
});
// ============ HELPER FUNCTIONS ============

async function sendVerificationEmail(email, code, firstName) {
    if (!transporter) {
        console.log('⚠️  Email transporter not available - skipping email send');
        return;
    }

    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify Your Email - Sibo Life Sciences',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #0066cc;">Welcome to Sibo Life Sciences!</h2>
                    <p>Hello ${firstName},</p>
                    <p>Your verification code is:</p>
                    <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
                        <h1 style="color: #0066cc; letter-spacing: 5px; font-size: 2.5rem;">${code}</h1>
                    </div>
                    <p>This code expires in 30 minutes.</p>
                    <br>
                    <p>Best regards,<br>Sibo Life Sciences Team</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('✅ Verification email sent to:', email);
    } catch (error) {
        console.error('❌ Failed to send verification email:', error);
    }
}

async function sendResetEmail(email, code, firstName) {
    if (!transporter) return;

    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset - Sibo Life Sciences',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #0066cc;">Password Reset</h2>
                    <p>Hello ${firstName},</p>
                    <p>Your password reset code is:</p>
                    <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
                        <h1 style="color: #0066cc; letter-spacing: 5px; font-size: 2.5rem;">${code}</h1>
                    </div>
                    <p>This code expires in 30 minutes.</p>
                    <br>
                    <p>Best regards,<br>Sibo Life Sciences Team</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('✅ Reset email sent to:', email);
    } catch (error) {
        console.error('❌ Failed to send reset email:', error);
    }
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

// ============ START SERVER ============


app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`🚀 Sibo Life Sciences Server`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`🌐 Admin: http://localhost:${PORT}/admin`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📧 Email: ${process.env.EMAIL_USER ? 'Configured' : 'Not configured'}`);
    console.log(`🗄️  Supabase: ${process.env.SUPABASE_URL ? 'Connected' : 'Not connected'}`);
    console.log('='.repeat(50));
    console.log('\n📋 Available Endpoints:');
    console.log(`   GET  /              - Website homepage`);
    console.log(`   GET  /admin         - Admin dashboard`);
    console.log(`   GET  /api/health    - Health check`);
    console.log(`   POST /api/register  - Register user`);
    console.log(`   POST /api/login     - Login user`);
    console.log(`   POST /api/contact   - Contact form`);
    console.log(`   POST /api/mpesa/stk-push - M-Pesa payment`);
    console.log('\n📁 Static files are served from current directory');
});
