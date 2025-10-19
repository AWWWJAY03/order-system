// Configuration
const CONFIG = {
    // Replace this with your Google Apps Script Web App URL after deployment
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
    
    // Replace with your Google Sheets URL for admin access
    SHEETS_URL: 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit',
    
    // QR Code generation settings
    QR_API_BASE: 'https://chart.googleapis.com/chart',
    QR_SIZE: '150x150'
};

// Global variables
let products = [];
let currentOrder = null;

/**
 * Load and display all products from Google Sheets
 */
async function loadProducts() {
    try {
        showLoading(true);
        
        const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=getProducts`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            products = data.products;
            displayProducts(products);
            updateSheetsLink();
        } else {
            throw new Error(data.message || 'Failed to load products');
        }
        
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products. Please check your connection and try again.');
    } finally {
        showLoading(false);
    }
}

/**
 * Display products in the grid
 */
function displayProducts(products) {
    const container = document.getElementById('products-container');
    
    if (!container) return;
    
    if (!products || products.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #666; grid-column: 1 / -1;">
                <h3>No products available</h3>
                <p>Please add products to your Google Sheets inventory.</p>
            </div>
        `;
        container.style.display = 'block';
        return;
    }
    
    container.innerHTML = products.map(product => {
        const qrUrl = generateQRCodeUrl(product.ProductID);
        const isOutOfStock = parseInt(product.Stock) <= 0;
        
        return `
            <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" onclick="${isOutOfStock ? '' : `openOrderPage('${product.ProductID}')`}">
                <div class="product-name">${escapeHtml(product.Name)}</div>
                <div class="product-description">${escapeHtml(product.Description)}</div>
                <div class="product-details">
                    <div class="product-price">₱${parseFloat(product.Price).toFixed(2)}</div>
                    <div>
                        <span class="product-category">${escapeHtml(product.Category)}</span>
                        <span class="product-package">${escapeHtml(product.PackageSize)}</span>
                    </div>
                </div>
                <div style="margin-top: 15px; color: ${isOutOfStock ? '#e74c3c' : '#666'};">
                    <strong>Stock:</strong> ${product.Stock} ${isOutOfStock ? '(Out of Stock)' : 'available'}
                </div>
                <div class="qr-section">
                    <p style="font-size: 0.9em; color: #666; margin-bottom: 10px;">
                        ${isOutOfStock ? 'Currently unavailable' : 'Scan to order:'}
                    </p>
                    ${isOutOfStock ? 
                        '<div style="width: 120px; height: 120px; background: #f0f0f0; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin: 10px auto; color: #999;">Out of Stock</div>' :
                        `<img src="${qrUrl}" alt="QR Code for ${escapeHtml(product.Name)}" class="qr-code" onerror="this.style.display='none'">`
                    }
                </div>
            </div>
        `;
    }).join('');
    
    container.style.display = 'grid';
}

/**
 * Generate QR code URL for a product
 */
function generateQRCodeUrl(productId) {
    const orderUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}order.html?product_id=${productId}`;
    return `${CONFIG.QR_API_BASE}?chs=${CONFIG.QR_SIZE}&cht=qr&chl=${encodeURIComponent(orderUrl)}`;
}

/**
 * Open order page for specific product
 */
function openOrderPage(productId) {
    window.location.href = `order.html?product_id=${productId}`;
}

/**
 * Get product details by ID
 */
async function getProductById(productId) {
    try {
        const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=getProduct&productId=${productId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            return data.product;
        } else {
            throw new Error(data.message || 'Product not found');
        }
        
    } catch (error) {
        console.error('Error fetching product:', error);
        throw error;
    }
}

/**
 * Submit order to Google Sheets
 */
async function submitOrder(orderData) {
    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'createOrder',
                orderData: orderData
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            return {
                success: true,
                orderId: data.orderId,
                message: 'Order placed successfully'
            };
        } else {
            throw new Error(data.message || 'Failed to place order');
        }
        
    } catch (error) {
        console.error('Error submitting order:', error);
        return {
            success: false,
            message: error.message || 'Failed to place order'
        };
    }
}

/**
 * Update order status
 */
async function updateOrderStatus(orderId, status, trackingNumber = null) {
    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateOrder',
                orderId: orderId,
                status: status,
                trackingNumber: trackingNumber
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error('Error updating order status:', error);
        throw error;
    }
}

/**
 * Validate form data
 */
function validateOrderForm(formData) {
    const errors = [];
    
    // Customer name validation
    if (!formData.get('customerName') || formData.get('customerName').trim().length < 2) {
        errors.push('Please enter a valid customer name (minimum 2 characters)');
    }
    
    // Contact number validation (Philippine mobile number format)
    const contact = formData.get('contact');
    const phoneRegex = /^(09|\+639)\d{9}$/;
    if (!contact || !phoneRegex.test(contact.replace(/\s+/g, ''))) {
        errors.push('Please enter a valid Philippine mobile number (09xxxxxxxxx)');
    }
    
    // Address validation
    if (!formData.get('address') || formData.get('address').trim().length < 10) {
        errors.push('Please enter a complete shipping address (minimum 10 characters)');
    }
    
    return errors;
}

/**
 * Format currency
 */
function formatCurrency(amount) {
    return `₱${parseFloat(amount).toFixed(2)}`;
}

/**
 * Generate unique order ID
 */
function generateOrderId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD${timestamp}${random}`;
}

/**
 * Show loading state
 */
function showLoading(show) {
    const loadingElement = document.getElementById('loading');
    const productsContainer = document.getElementById('products-container');
    const errorElement = document.getElementById('error');
    
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
    
    if (productsContainer) {
        productsContainer.style.display = show ? 'none' : 'grid';
    }
    
    if (errorElement && !show) {
        errorElement.style.display = 'none';
    }
}

/**
 * Show error message
 */
function showError(message) {
    const errorElement = document.getElementById('error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
    showLoading(false);
}

/**
 * Show success message
 */
function showSuccess(message) {
    const successElement = document.getElementById('success');
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
    }
}

/**
 * Update Google Sheets link in admin section
 */
function updateSheetsLink() {
    const sheetsLink = document.getElementById('sheets-link');
    if (sheetsLink && CONFIG.SHEETS_URL !== 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit') {
        sheetsLink.href = CONFIG.SHEETS_URL;
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            return true;
        } catch (err) {
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    }
}

/**
 * Format date for display
 */
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Debounce function to limit API calls
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Check if user is online
 */
function checkOnlineStatus() {
    if (!navigator.onLine) {
        showError('You are currently offline. Please check your internet connection.');
        return false;
    }
    return true;
}

/**
 * Handle network errors gracefully
 */
function handleNetworkError(error) {
    if (!navigator.onLine) {
        return 'You are currently offline. Please check your internet connection.';
    }
    
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        return 'Network error. Please check your internet connection and try again.';
    }
    
    return error.message || 'An unexpected error occurred. Please try again.';
}

// Event listeners for online/offline status
window.addEventListener('online', function() {
    console.log('Connection restored');
    // You could add a notification here
});

window.addEventListener('offline', function() {
    console.log('Connection lost');
    showError('Connection lost. Please check your internet connection.');
});

// Add CSS for out of stock products
const outOfStockStyles = `
    <style>
        .product-card.out-of-stock {
            opacity: 0.6;
            cursor: not-allowed;
            background: #f5f5f5;
        }
        
        .product-card.out-of-stock:hover {
            transform: none;
            box-shadow: none;
        }
        
        .product-card.out-of-stock .product-price {
            color: #999;
        }
        
        .loading-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #4facfe;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
`;

// Add styles to document head
document.head.insertAdjacentHTML('beforeend', outOfStockStyles);

// Export functions for testing (if in Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateQRCodeUrl,
        validateOrderForm,
        formatCurrency,
        generateOrderId,
        escapeHtml,
        formatDate,
        debounce
    };
}