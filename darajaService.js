const axios = require('axios');
const base64 = require('base64-js');

class DarajaService {
    constructor() {
        // YOUR SANDBOX CREDENTIALS
        this.consumerKey = 'xiK0TknA9DrGMJTDHdG0y3Vu3clOrid7CKzkyVLKrbvgSTdY';
        this.consumerSecret = '5Aql24vgKzF9dNoSyhDOebI83SCuo0JCAdj8VaoyH5CaKD7BZag6TUrfFKTNGG9y';
        this.shortCode = '174379'; // Test Paybill
        this.passKey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
        this.accessToken = null;
        this.tokenExpiry = null;
        this.baseUrl = 'https://sandbox.safaricom.co.ke';
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

    async sendSTKPush(phone, amount, orderId, accountReference = 'SIBO-LIFE') {
        try {
            const accessToken = await this.getAccessToken();
            
            // Format phone
            let formattedPhone = phone;
            if (phone.startsWith('0')) {
                formattedPhone = '254' + phone.substring(1);
            } else if (phone.startsWith('+254')) {
                formattedPhone = phone.substring(1);
            }
            
            // Generate timestamp and password
            const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
            const password = base64.fromByteArray(
                Buffer.from(`${this.shortCode}${this.passKey}${timestamp}`)
            );
            
            const payload = {
                BusinessShortCode: this.shortCode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: amount,
                PartyA: formattedPhone,
                PartyB: this.shortCode,
                PhoneNumber: formattedPhone,
                // In sendSTKPush method:
CallBackURL: 'https://sandbox.safaricom.co.ke/mpesa/callback', // Works without registration
                AccountReference: accountReference,
                TransactionDesc: `Payment for Sibo Life Sciences - Order ${orderId}`
            };

            console.log('🚀 Sending STK Push:', {
                phone: formattedPhone,
                amount,
                orderId,
                accountReference
            });

            const response = await axios.post(
                `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('✅ STK Push response:', response.data);

            return {
                success: true,
                checkoutRequestID: response.data.CheckoutRequestID,
                merchantRequestID: response.data.MerchantRequestID,
                customerMessage: response.data.CustomerMessage || 'Enter your M-Pesa PIN on your phone',
                responseCode: response.data.ResponseCode,
                responseDescription: response.data.ResponseDescription
            };

        } catch (error) {
            console.error('❌ STK Push error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.errorMessage || error.message
            };
        }
    }

    async checkPaymentStatus(checkoutRequestID) {
        try {
            const accessToken = await this.getAccessToken();
            const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
            const password = base64.fromByteArray(
                Buffer.from(`${this.shortCode}${this.passKey}${timestamp}`)
            );

            const payload = {
                BusinessShortCode: this.shortCode,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestID
            };

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
                return {
                    success: true,
                    status: 'completed',
                    mpesaReceipt: result.MpesaReceiptNumber,
                    phone: result.PhoneNumber,
                    amount: result.Amount,
                    transactionDate: result.TransactionDate,
                    resultDesc: result.ResultDesc
                };
            } else {
                // Payment failed
                return {
                    success: false,
                    status: 'failed',
                    errorCode: result.ResultCode,
                    errorMessage: result.ResultDesc
                };
            }

        } catch (error) {
            console.error('❌ Check payment error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new DarajaService();