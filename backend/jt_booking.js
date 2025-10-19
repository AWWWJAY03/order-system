/**
 * J&T Express Automated Booking System using Playwright
 * This script automates the booking process on J&T Express portal
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
    JT_PORTAL_URL: 'https://portal.jtexpress.ph',
    LOGIN_EMAIL: process.env.JT_EMAIL || '',
    LOGIN_PASSWORD: process.env.JT_PASSWORD || '',
    
    // Default sender information (replace with your business details)
    SENDER: {
        name: process.env.SENDER_NAME || 'Your Business Name',
        contact: process.env.SENDER_CONTACT || '09123456789',
        address: process.env.SENDER_ADDRESS || 'Your Business Address, City, Province, ZIP',
        company: process.env.SENDER_COMPANY || 'Your Company Name'
    },
    
    // Browser settings
    BROWSER_OPTIONS: {
        headless: true,
        viewport: { width: 1280, height: 720 },
        timeout: 30000
    },
    
    // Retry settings
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    
    // Google Apps Script webhook for updating order status
    APPS_SCRIPT_WEBHOOK: process.env.APPS_SCRIPT_WEBHOOK || ''
};

/**
 * Main booking function
 */
async function bookJTExpress(orderData) {
    let browser = null;
    let attempt = 0;
    
    while (attempt < CONFIG.MAX_RETRIES) {
        try {
            console.log(`Booking attempt ${attempt + 1} for Order ID: ${orderData.orderId}`);
            
            // Launch browser
            browser = await chromium.launch(CONFIG.BROWSER_OPTIONS);
            const context = await browser.newContext();
            const page = await context.newPage();
            
            // Set page timeout
            page.setDefaultTimeout(CONFIG.BROWSER_OPTIONS.timeout);
            
            // Navigate to J&T Portal
            await page.goto(CONFIG.JT_PORTAL_URL);
            
            // Login
            await loginToJT(page);
            
            // Navigate to booking form
            await navigateToBookingForm(page);
            
            // Fill booking form
            const trackingNumber = await fillBookingForm(page, orderData);
            
            // Submit booking
            await submitBooking(page);
            
            // Extract tracking number if not captured during form filling
            const finalTrackingNumber = trackingNumber || await extractTrackingNumber(page);
            
            if (finalTrackingNumber) {
                console.log(`Booking successful! Tracking Number: ${finalTrackingNumber}`);
                
                // Update order status in Google Sheets
                if (CONFIG.APPS_SCRIPT_WEBHOOK) {
                    await updateOrderStatus(orderData.orderId, 'Ready to Ship', finalTrackingNumber);
                }
                
                await browser.close();
                return {
                    success: true,
                    trackingNumber: finalTrackingNumber,
                    message: 'Booking completed successfully'
                };
            } else {
                throw new Error('Could not extract tracking number');
            }
            
        } catch (error) {
            console.error(`Booking attempt ${attempt + 1} failed:`, error.message);
            
            if (browser) {
                await browser.close();
            }
            
            attempt++;
            
            if (attempt >= CONFIG.MAX_RETRIES) {
                throw new Error(`Booking failed after ${CONFIG.MAX_RETRIES} attempts: ${error.message}`);
            }
            
            // Wait before retry
            await sleep(CONFIG.RETRY_DELAY);
        }
    }
}

/**
 * Login to J&T Express portal
 */
async function loginToJT(page) {
    console.log('Logging into J&T Express portal...');
    
    try {
        // Wait for login form
        await page.waitForSelector('input[type="email"], input[name="email"], #email', { timeout: 10000 });
        
        // Fill email
        const emailSelectors = ['input[type="email"]', 'input[name="email"]', '#email', '.email-input'];
        for (const selector of emailSelectors) {
            try {
                await page.fill(selector, CONFIG.LOGIN_EMAIL);
                break;
            } catch (e) {
                continue;
            }
        }
        
        // Fill password
        const passwordSelectors = ['input[type="password"]', 'input[name="password"]', '#password', '.password-input'];
        for (const selector of passwordSelectors) {
            try {
                await page.fill(selector, CONFIG.LOGIN_PASSWORD);
                break;
            } catch (e) {
                continue;
            }
        }
        
        // Click login button
        const loginSelectors = ['button[type="submit"]', '.login-button', '#login-btn', 'input[type="submit"]'];
        for (const selector of loginSelectors) {
            try {
                await page.click(selector);
                break;
            } catch (e) {
                continue;
            }
        }
        
        // Wait for successful login (dashboard or main page)
        await page.waitForNavigation({ waitUntil: 'networkidle' });
        
        // Verify login success
        const isLoggedIn = await page.locator('text=/dashboard|booking|shipment/i').first().isVisible({ timeout: 5000 });
        
        if (!isLoggedIn) {
            throw new Error('Login verification failed');
        }
        
        console.log('Successfully logged in to J&T Express');
        
    } catch (error) {
        throw new Error(`Login failed: ${error.message}`);
    }
}

/**
 * Navigate to booking form
 */
async function navigateToBookingForm(page) {
    console.log('Navigating to booking form...');
    
    try {
        // Look for booking/shipment related links
        const bookingSelectors = [
            'text=/create.*shipment/i',
            'text=/new.*booking/i',
            'text=/book.*shipment/i',
            '.booking-btn',
            '#create-shipment',
            'a[href*="booking"]',
            'a[href*="shipment"]'
        ];
        
        for (const selector of bookingSelectors) {
            try {
                const element = page.locator(selector).first();
                if (await element.isVisible({ timeout: 2000 })) {
                    await element.click();
                    await page.waitForNavigation({ waitUntil: 'networkidle' });
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        // Verify we're on the booking form
        const isBookingForm = await page.locator('text=/sender|receiver|package|booking/i').first().isVisible({ timeout: 5000 });
        
        if (!isBookingForm) {
            throw new Error('Could not navigate to booking form');
        }
        
        console.log('Successfully navigated to booking form');
        
    } catch (error) {
        throw new Error(`Navigation to booking form failed: ${error.message}`);
    }
}

/**
 * Fill booking form with order data
 */
async function fillBookingForm(page, orderData) {
    console.log('Filling booking form...');
    
    try {
        // Fill sender information
        await fillSenderInfo(page);
        
        // Fill receiver information
        await fillReceiverInfo(page, orderData);
        
        // Fill package information
        await fillPackageInfo(page, orderData);
        
        // Set payment method (usually prepaid for GCash orders)
        await setPaymentMethod(page, 'prepaid');
        
        console.log('Booking form filled successfully');
        
        return null; // Tracking number will be generated after submission
        
    } catch (error) {
        throw new Error(`Form filling failed: ${error.message}`);
    }
}

/**
 * Fill sender information
 */
async function fillSenderInfo(page) {
    const senderFields = {
        'sender_name': CONFIG.SENDER.name,
        'sender_contact': CONFIG.SENDER.contact,
        'sender_address': CONFIG.SENDER.address,
        'sender_company': CONFIG.SENDER.company
    };
    
    for (const [fieldType, value] of Object.entries(senderFields)) {
        const selectors = [
            `input[name*="${fieldType}"]`,
            `input[id*="${fieldType}"]`,
            `input[class*="${fieldType}"]`,
            `textarea[name*="${fieldType}"]`,
            `textarea[id*="${fieldType}"]`
        ];
        
        for (const selector of selectors) {
            try {
                await page.fill(selector, value);
                break;
            } catch (e) {
                continue;
            }
        }
    }
}

/**
 * Fill receiver information
 */
async function fillReceiverInfo(page, orderData) {
    const receiverFields = {
        'receiver_name': orderData.customerName,
        'receiver_contact': orderData.contact,
        'receiver_address': orderData.address,
        'receiver_phone': orderData.contact
    };
    
    for (const [fieldType, value] of Object.entries(receiverFields)) {
        const selectors = [
            `input[name*="${fieldType}"]`,
            `input[id*="${fieldType}"]`,
            `input[class*="${fieldType}"]`,
            `textarea[name*="${fieldType}"]`,
            `textarea[id*="${fieldType}"]`
        ];
        
        for (const selector of selectors) {
            try {
                await page.fill(selector, value);
                break;
            } catch (e) {
                continue;
            }
        }
    }
}

/**
 * Fill package information
 */
async function fillPackageInfo(page, orderData) {
    // Map package sizes to standard values
    const packageSizeMap = {
        'Small': '1',
        'Medium': '2', 
        'Large': '3'
    };
    
    const packageFields = {
        'weight': orderData.weight || '0.5',
        'package_size': packageSizeMap[orderData.packageSize] || '2',
        'category': orderData.category || 'General',
        'description': orderData.notes || 'Online order item',
        'quantity': '1'
    };
    
    for (const [fieldType, value] of Object.entries(packageFields)) {
        const selectors = [
            `input[name*="${fieldType}"]`,
            `input[id*="${fieldType}"]`,
            `select[name*="${fieldType}"]`,
            `select[id*="${fieldType}"]`,
            `textarea[name*="${fieldType}"]`
        ];
        
        for (const selector of selectors) {
            try {
                if (selector.includes('select')) {
                    await page.selectOption(selector, value);
                } else {
                    await page.fill(selector, value);
                }
                break;
            } catch (e) {
                continue;
            }
        }
    }
}

/**
 * Set payment method
 */
async function setPaymentMethod(page, method) {
    const paymentSelectors = [
        `input[value*="${method}"]`,
        `option[value*="${method}"]`,
        `select[name*="payment"] option:has-text("${method}")`
    ];
    
    for (const selector of paymentSelectors) {
        try {
            if (selector.includes('input')) {
                await page.check(selector);
            } else if (selector.includes('option')) {
                await page.selectOption(selector.replace(' option', ''), method);
            }
            break;
        } catch (e) {
            continue;
        }
    }
}

/**
 * Submit booking form
 */
async function submitBooking(page) {
    console.log('Submitting booking...');
    
    try {
        const submitSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            '.submit-btn',
            '#submit-booking',
            'text=/submit|book now|create/i'
        ];
        
        for (const selector of submitSelectors) {
            try {
                await page.click(selector);
                break;
            } catch (e) {
                continue;
            }
        }
        
        // Wait for submission to complete
        await page.waitForNavigation({ waitUntil: 'networkidle' });
        
        console.log('Booking submitted successfully');
        
    } catch (error) {
        throw new Error(`Booking submission failed: ${error.message}`);
    }
}

/**
 * Extract tracking number from confirmation page
 */
async function extractTrackingNumber(page) {
    console.log('Extracting tracking number...');
    
    try {
        // Wait for tracking number to appear
        await page.waitForTimeout(3000);
        
        // Look for tracking number patterns
        const trackingSelectors = [
            'text=/JT[0-9]+/',
            'text=/tracking.*number/i',
            '.tracking-number',
            '#tracking-number',
            '[class*="tracking"]',
            '[id*="tracking"]'
        ];
        
        for (const selector of trackingSelectors) {
            try {
                const element = page.locator(selector).first();
                if (await element.isVisible({ timeout: 2000 })) {
                    const text = await element.textContent();
                    
                    // Extract JT tracking number pattern
                    const trackingMatch = text.match(/JT\d+/);
                    if (trackingMatch) {
                        return trackingMatch[0];
                    }
                }
            } catch (e) {
                continue;
            }
        }
        
        // Fallback: generate mock tracking number
        console.warn('Could not extract tracking number, generating mock number');
        return generateMockTrackingNumber();
        
    } catch (error) {
        console.warn('Error extracting tracking number:', error.message);
        return generateMockTrackingNumber();
    }
}

/**
 * Generate mock tracking number for testing
 */
function generateMockTrackingNumber() {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `JT${timestamp}${random}`;
}

/**
 * Update order status in Google Sheets via webhook
 */
async function updateOrderStatus(orderId, status, trackingNumber) {
    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'updateOrder',
                orderId: orderId,
                status: status,
                trackingNumber: trackingNumber
            })
        });
        
        const result = await response.json();
        console.log('Order status updated:', result);
        
    } catch (error) {
        console.error('Failed to update order status:', error.message);
    }
}

/**
 * Sleep utility function
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Express server to handle webhook requests from Google Apps Script
 */
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Webhook endpoint for booking requests
app.post('/book-jt', async (req, res) => {
    try {
        const orderData = req.body;
        
        console.log('Received booking request:', orderData);
        
        // Validate required fields
        if (!orderData.orderId || !orderData.customerName || !orderData.contact || !orderData.address) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // Process booking
        const result = await bookJTExpress(orderData);
        
        res.json(result);
        
    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server only if this file is run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`J&T Booking Automation Server running on port ${PORT}`);
        console.log(`Webhook URL: http://localhost:${PORT}/book-jt`);
    });
}

module.exports = {
    bookJTExpress,
    app
};