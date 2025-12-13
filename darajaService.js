const axios = require('axios');

class DarajaService {
    constructor() {
        // ============ CONFIGURATION ============
        // Switch to 'production' when ready to go live
        this.environment = process.env.MPESA_ENVIRONMENT || 'production'; // 'sandbox' or 'production'
        
        // ============ YOUR REAL PRODUCTION CREDENTIALS ============
        const configs = {
            sandbox: {
                consumerKey: 'xiK0TknA9DrGMJTDHdG0y3Vu3clOrid7CKzkyVLKrbvgSTdY',
                consumerSecret: '5Aql24vgKzF9dNoSyhDOebI83SCuo0JCAdj8VaoyH5CaKD7BZag6TUrfFKTNGG9y',
                shortCode: '174379',
                passKey: 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
                baseUrl: 'https://sandbox.safaricom.co.ke',
                callBackURL: 'https://sibo-life-sciences.onrender.com/api/mpesa/callback',
                accountReference: 'SIBO-TEST',
                businessName: 'SIBO LIFE SCIENCES'
            },
            production: {
                consumerKey: process.env.MPESA_CONSUMER_KEY || 'YOUR_PRODUCTION_CONSUMER_KEY',
                consumerSecret: process.env.MPESA_CONSUMER_SECRET || 'YOUR_PRODUCTION_CONSUMER_SECRET',
                shortCode: '972900', // ✅ CORRECTED: YOUR REAL PAYBILL 972900
                passKey: process.env.MPESA_PASS_KEY || 'YOUR_PRODUCTION_PASS_KEY',
                baseUrl: 'https://api.safaricom.co.ke',
                callBackURL: 'https://sibo-life-sciences.onrender.com/api/mpesa/callback',
                accountReference: '08716900002', // YOUR ACCOUNT NUMBER
                businessName: 'SIBO LIFE SCIENCES'
            }
        };

        this.config = configs[this.environment];
        
        // Apply configuration
        this.consumerKey = this.config.consumerKey;
        this.consumerSecret = this.config.consumerSecret;
        this.shortCode = this.config.shortCode;
        this.passKey = this.config.passKey;
        this.baseUrl = this.config.baseUrl;
        
        this.accessToken = null;
        this.tokenExpiry = null;
        
        console.log(`🚀 M-Pesa initialized in: ${this.environment.toUpperCase()} mode`);
        console.log(`💰 Paybill: ${this.shortCode} (Sibo Life Sciences)`);
        console.log(`🏢 Business: ${this.config.businessName}`);
        console.log(`📁 Account: ${this.config.accountReference}`);
    }

    async getAccessToken() {
        // Return cached token if valid
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
        
        try {
            const response = await axios.get(
                `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
                {
                    headers: {
                        'Authorization': `Basic ${auth}`
                    }
                }
            );
            
            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (3500 * 1000); // 1 hour expiry
            return this.accessToken;
        } catch (error) {
            console.error('❌ Daraja auth error:', error.response?.data || error.message);
            throw error;
        }
    }

    async sendSTKPush(phone, amount, orderId, accountReference = null) {
        try {
            const accessToken = await this.getAccessToken();
            
            // Format phone
            let formattedPhone = phone;
            if (phone.startsWith('0')) {
                formattedPhone = '254' + phone.substring(1);
            } else if (phone.startsWith('+254')) {
                formattedPhone = phone.substring(1);
            } else if (phone.length === 9) {
                formattedPhone = '254' + phone;
            }
            
           // REPLACE WITH THIS:
// Format phone for Paystack
let formattedPhone = mpesaPhone.replace(/\D/g, ''); // Remove non-digits

// Accept multiple formats
if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
    formattedPhone = '254' + formattedPhone.substring(1); // 0704371652 → 254704371652
} else if (formattedPhone.startsWith('254') && formattedPhone.length === 12) {
    // Already correct
} else if (formattedPhone.length === 9) {
    formattedPhone = '254' + formattedPhone; // 704371652 → 254704371652
}

console.log('📱 Formatted phone for Paystack:', formattedPhone);
            
            // Generate timestamp and password
            const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
            const password = Buffer.from(`${this.shortCode}${this.passKey}${timestamp}`).toString('base64');
            
            const payload = {
                BusinessShortCode: this.shortCode, // Your Paybill 972900
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: Math.round(amount), // Ensure whole number
                PartyA: formattedPhone, // Customer's phone
                PartyB: this.shortCode, // Your Paybill 972900
                PhoneNumber: formattedPhone,
                CallBackURL: this.config.callBackURL,
                AccountReference: accountReference || this.config.accountReference || '08716900002',
                TransactionDesc: `Payment for ${this.config.businessName} - Order ${orderId}`
            };

            console.log('🚀 Sending REAL STK Push to Paybill 972900:', {
                environment: this.environment,
                business: this.config.businessName,
                phone: formattedPhone,
                amount: `${amount} KES`,
                orderId,
                accountReference: payload.AccountReference,
                paybill: this.shortCode,
                timestamp
            });

            const response = await axios.post(
                `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000 // 30 second timeout
                }
            );

            console.log('✅ STK Push response:', response.data);

            return {
                success: true,
                environment: this.environment,
                checkoutRequestID: response.data.CheckoutRequestID,
                merchantRequestID: response.data.MerchantRequestID,
                customerMessage: response.data.CustomerMessage || `Pay ${this.config.businessName} KSh ${amount}. Enter M-Pesa PIN`,
                responseCode: response.data.ResponseCode,
                responseDescription: response.data.ResponseDescription,
                businessName: this.config.businessName,
                paybill: this.shortCode
            };

        } catch (error) {
            console.error('❌ STK Push error:', {
                environment: this.environment,
                business: this.config.businessName,
                paybill: this.shortCode,
                error: error.response?.data || error.message
            });
            
            let errorMessage = 'Payment request failed';
            if (error.response?.data?.errorMessage) {
                errorMessage = error.response.data.errorMessage;
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Payment request timeout. Please try again.';
            } else if (error.message.includes('Network Error')) {
                errorMessage = 'Network error. Check your internet connection.';
            }
            
            return {
                success: false,
                environment: this.environment,
                error: errorMessage,
                businessName: this.config.businessName,
                paybill: this.shortCode
            };
        }
    }

    async checkPaymentStatus(checkoutRequestID) {
        try {
            const accessToken = await this.getAccessToken();
            const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
            const password = Buffer.from(`${this.shortCode}${this.passKey}${timestamp}`).toString('base64');

            const payload = {
                BusinessShortCode: this.shortCode,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestID
            };

            console.log('🔍 Checking payment status for Paybill 972900:', {
                environment: this.environment,
                business: this.config.businessName,
                checkoutRequestID
            });

            const response = await axios.post(
                `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const result = response.data;
            
            if (result.ResultCode === '0') {
                // Payment successful
                console.log('✅ Payment completed to Paybill 972900:', {
                    business: this.config.businessName,
                    mpesaReceipt: result.MpesaReceiptNumber,
                    amount: result.Amount,
                    phone: result.PhoneNumber
                });
                
                return {
                    success: true,
                    status: 'completed',
                    mpesaReceipt: result.MpesaReceiptNumber,
                    phone: result.PhoneNumber,
                    amount: result.Amount,
                    transactionDate: result.TransactionDate,
                    resultDesc: result.ResultDesc,
                    businessName: this.config.businessName,
                    paybill: this.shortCode
                };
            } else {
                // Payment failed
                console.log('❌ Payment failed for Paybill 972900:', result.ResultDesc);
                
                return {
                    success: false,
                    status: 'failed',
                    errorCode: result.ResultCode,
                    errorMessage: result.ResultDesc,
                    businessName: this.config.businessName,
                    paybill: this.shortCode
                };
            }

        } catch (error) {
            console.error('❌ Check payment error:', {
                environment: this.environment,
                business: this.config.businessName,
                paybill: this.shortCode,
                error: error.response?.data || error.message
            });
            return {
                success: false,
                error: error.message,
                businessName: this.config.businessName,
                paybill: this.shortCode
            };
        }
    }

    // Helper method to get payment instructions
    getPaymentInstructions() {
        return {
            paybill: this.shortCode,
            accountNumber: this.config.accountReference,
            businessName: this.config.businessName,
            environment: this.environment,
            instructions: `Pay to ${this.config.businessName}\nPaybill: ${this.shortCode}\nAccount: ${this.config.accountReference}`
        };
    }
}

// Export instance
const daraja = new DarajaService();
module.exports = daraja;