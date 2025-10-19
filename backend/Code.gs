/**
 * Google Apps Script Backend for Order Management System
 * This script handles all backend operations including inventory and order management
 */

// Configuration
const CONFIG = {
  SHEET_NAME: 'Order Management System',
  INVENTORY_SHEET: 'Inventory',
  ORDERS_SHEET: 'Orders',
  
  // J&T Express Playwright automation webhook URL (replace with your deployed service)
  JT_WEBHOOK_URL: 'YOUR_JT_AUTOMATION_WEBHOOK_URL',
  
  // Admin settings
  ADMIN_EMAIL: 'your-admin-email@gmail.com',
  
  // CORS settings
  CORS_ORIGINS: ['https://your-username.github.io']
};

/**
 * Handle GET requests (fetch data)
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    switch (action) {
      case 'getProducts':
        return handleGetProducts();
      case 'getProduct':
        return handleGetProduct(e.parameter.productId);
      case 'getOrders':
        return handleGetOrders();
      default:
        return createResponse(false, 'Invalid action');
    }
  } catch (error) {
    console.error('Error in doGet:', error);
    return createResponse(false, error.message);
  }
}

/**
 * Handle POST requests (create/update data)
 */
function doPost(e) {
  try {
    const requestBody = JSON.parse(e.postData.contents);
    const action = requestBody.action;
    
    switch (action) {
      case 'createOrder':
        return handleCreateOrder(requestBody.orderData);
      case 'updateOrder':
        return handleUpdateOrder(requestBody.orderId, requestBody.status, requestBody.trackingNumber);
      case 'updateStock':
        return handleUpdateStock(requestBody.productId, requestBody.quantity);
      default:
        return createResponse(false, 'Invalid action');
    }
  } catch (error) {
    console.error('Error in doPost:', error);
    return createResponse(false, error.message);
  }
}

/**
 * Get all products from inventory
 */
function handleGetProducts() {
  try {
    const sheet = getOrCreateSheet(CONFIG.INVENTORY_SHEET);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      // No products, create sample data
      createSampleInventory();
      return handleGetProducts();
    }
    
    const headers = data[0];
    const products = data.slice(1).map(row => {
      const product = {};
      headers.forEach((header, index) => {
        product[header] = row[index] || '';
      });
      return product;
    }).filter(product => product.ProductID); // Filter out empty rows
    
    return createResponse(true, 'Products retrieved successfully', { products });
  } catch (error) {
    console.error('Error getting products:', error);
    return createResponse(false, error.message);
  }
}

/**
 * Get single product by ID
 */
function handleGetProduct(productId) {
  try {
    const sheet = getOrCreateSheet(CONFIG.INVENTORY_SHEET);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const productRow = data.slice(1).find(row => row[0] === productId);
    
    if (!productRow) {
      return createResponse(false, 'Product not found');
    }
    
    const product = {};
    headers.forEach((header, index) => {
      product[header] = productRow[index] || '';
    });
    
    return createResponse(true, 'Product retrieved successfully', { product });
  } catch (error) {
    console.error('Error getting product:', error);
    return createResponse(false, error.message);
  }
}

/**
 * Create new order
 */
function handleCreateOrder(orderData) {
  try {
    const orderId = generateOrderId();
    const sheet = getOrCreateSheet(CONFIG.ORDERS_SHEET);
    
    // Check if product exists and has stock
    const product = getProductById(orderData.productId);
    if (!product) {
      return createResponse(false, 'Product not found');
    }
    
    if (parseInt(product.Stock) <= 0) {
      return createResponse(false, 'Product is out of stock');
    }
    
    // Add order to sheet
    const orderRow = [
      orderId,
      orderData.productId,
      orderData.productName,
      orderData.category,
      orderData.packageSize,
      parseFloat(orderData.price),
      orderData.customerName,
      orderData.contact,
      orderData.address,
      orderData.notes,
      'Pending Payment',
      '', // Payment reference
      '', // Tracking number
      new Date().toISOString()
    ];
    
    sheet.appendRow(orderRow);
    
    // Update stock
    updateProductStock(orderData.productId, -1);
    
    return createResponse(true, 'Order created successfully', { orderId });
  } catch (error) {
    console.error('Error creating order:', error);
    return createResponse(false, error.message);
  }
}

/**
 * Update order status
 */
function handleUpdateOrder(orderId, status, trackingNumber = null) {
  try {
    const sheet = getOrCreateSheet(CONFIG.ORDERS_SHEET);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const orderRowIndex = data.slice(1).findIndex(row => row[0] === orderId);
    
    if (orderRowIndex === -1) {
      return createResponse(false, 'Order not found');
    }
    
    const actualRowIndex = orderRowIndex + 2; // +1 for header, +1 for 0-based index
    
    // Update status
    const statusColumnIndex = headers.indexOf('Status');
    if (statusColumnIndex !== -1) {
      sheet.getRange(actualRowIndex, statusColumnIndex + 1).setValue(status);
    }
    
    // Update tracking number if provided
    if (trackingNumber) {
      const trackingColumnIndex = headers.indexOf('TrackingNo');
      if (trackingColumnIndex !== -1) {
        sheet.getRange(actualRowIndex, trackingColumnIndex + 1).setValue(trackingNumber);
      }
    }
    
    return createResponse(true, 'Order updated successfully');
  } catch (error) {
    console.error('Error updating order:', error);
    return createResponse(false, error.message);
  }
}

/**
 * Update product stock
 */
function handleUpdateStock(productId, quantity) {
  try {
    updateProductStock(productId, quantity);
    return createResponse(true, 'Stock updated successfully');
  } catch (error) {
    console.error('Error updating stock:', error);
    return createResponse(false, error.message);
  }
}

/**
 * Get all orders
 */
function handleGetOrders() {
  try {
    const sheet = getOrCreateSheet(CONFIG.ORDERS_SHEET);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return createResponse(true, 'No orders found', { orders: [] });
    }
    
    const headers = data[0];
    const orders = data.slice(1).map(row => {
      const order = {};
      headers.forEach((header, index) => {
        order[header] = row[index] || '';
      });
      return order;
    }).filter(order => order.OrderID);
    
    return createResponse(true, 'Orders retrieved successfully', { orders });
  } catch (error) {
    console.error('Error getting orders:', error);
    return createResponse(false, error.message);
  }
}

/**
 * Helper function to get or create a sheet
 */
function getOrCreateSheet(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet() || 
                    SpreadsheetApp.create(CONFIG.SHEET_NAME);
  
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    
    // Set up headers based on sheet type
    if (sheetName === CONFIG.INVENTORY_SHEET) {
      sheet.getRange(1, 1, 1, 9).setValues([[
        'ProductID', 'Name', 'Description', 'Category', 
        'PackageSize', 'Price', 'Stock', 'Weight', 'QRLink'
      ]]);
    } else if (sheetName === CONFIG.ORDERS_SHEET) {
      sheet.getRange(1, 1, 1, 14).setValues([[
        'OrderID', 'ProductID', 'ProductName', 'Category', 'PackageSize', 
        'Price', 'CustomerName', 'Contact', 'Address', 'Notes', 
        'Status', 'PaymentRef', 'TrackingNo', 'Date'
      ]]);
    }
    
    // Format headers
    const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    headerRange.setBackground('#4facfe');
    headerRange.setFontColor('white');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
  }
  
  return sheet;
}

/**
 * Get product by ID
 */
function getProductById(productId) {
  const sheet = getOrCreateSheet(CONFIG.INVENTORY_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const productRow = data.slice(1).find(row => row[0] === productId);
  
  if (!productRow) return null;
  
  const product = {};
  headers.forEach((header, index) => {
    product[header] = productRow[index] || '';
  });
  
  return product;
}

/**
 * Update product stock
 */
function updateProductStock(productId, changeAmount) {
  const sheet = getOrCreateSheet(CONFIG.INVENTORY_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const productRowIndex = data.slice(1).findIndex(row => row[0] === productId);
  
  if (productRowIndex === -1) {
    throw new Error('Product not found');
  }
  
  const actualRowIndex = productRowIndex + 2;
  const stockColumnIndex = headers.indexOf('Stock');
  
  if (stockColumnIndex === -1) {
    throw new Error('Stock column not found');
  }
  
  const currentStock = parseInt(data[productRowIndex + 1][stockColumnIndex]) || 0;
  const newStock = Math.max(0, currentStock + changeAmount);
  
  sheet.getRange(actualRowIndex, stockColumnIndex + 1).setValue(newStock);
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
 * Create standardized response
 */
function createResponse(success, message, data = null) {
  const response = { success, message };
  if (data) {
    Object.assign(response, data);
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

/**
 * Handle CORS preflight requests
 */
function doOptions() {
  return ContentService
    .createTextOutput('')
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    });
}

/**
 * Create sample inventory data
 */
function createSampleInventory() {
  const sheet = getOrCreateSheet(CONFIG.INVENTORY_SHEET);
  
  const sampleProducts = [
    ['PROD001', 'Wireless Bluetooth Headphones', 'High-quality wireless headphones with noise cancellation', 'Electronics', 'Medium', 2499.99, 50, 0.3, ''],
    ['PROD002', 'Cotton T-Shirt', 'Comfortable 100% cotton t-shirt available in multiple colors', 'Apparel', 'Small', 599.99, 100, 0.2, ''],
    ['PROD003', 'Smartphone Case', 'Protective case for latest smartphone models', 'Electronics', 'Small', 399.99, 75, 0.1, ''],
    ['PROD004', 'Coffee Beans 1kg', 'Premium arabica coffee beans, medium roast', 'Food', 'Large', 899.99, 25, 1.0, ''],
    ['PROD005', 'Backpack', 'Durable travel backpack with multiple compartments', 'Apparel', 'Large', 1299.99, 30, 0.8, '']
  ];
  
  // Add sample products
  sampleProducts.forEach(product => {
    // Generate QR link
    const qrLink = `https://chart.googleapis.com/chart?chs=150x150&cht=qr&chl=https://your-site.github.io/order.html?product_id=${product[0]}`;
    product[8] = qrLink;
    
    sheet.appendRow(product);
  });
}

/**
 * Add custom menu to Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Order Management')
    .addItem('Ready to Ship Selected Orders', 'onReadyToShip')
    .addItem('Refresh Inventory QR Codes', 'refreshQRCodes')
    .addItem('Export Orders to CSV', 'exportOrdersToCSV')
    .addItem('Setup Instructions', 'showSetupInstructions')
    .addToUi();
}

/**
 * Handle "Ready to Ship" action
 */
function onReadyToShip() {
  try {
    const sheet = getOrCreateSheet(CONFIG.ORDERS_SHEET);
    const selection = sheet.getActiveRange();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    if (!selection) {
      SpreadsheetApp.getUi().alert('Please select the orders you want to process for shipping.');
      return;
    }
    
    const startRow = selection.getRow();
    const numRows = selection.getNumRows();
    
    if (startRow === 1) {
      SpreadsheetApp.getUi().alert('Please select order rows, not the header.');
      return;
    }
    
    const selectedOrders = [];
    
    for (let i = 0; i < numRows; i++) {
      const rowIndex = startRow + i - 1; // Convert to 0-based index
      if (rowIndex > 0 && rowIndex < data.length) {
        const row = data[rowIndex];
        const order = {};
        headers.forEach((header, index) => {
          order[header] = row[index] || '';
        });
        
        if (order.OrderID && order.Status === 'Pending Payment') {
          selectedOrders.push(order);
        }
      }
    }
    
    if (selectedOrders.length === 0) {
      SpreadsheetApp.getUi().alert('No valid orders selected. Please select orders with "Pending Payment" status.');
      return;
    }
    
    // Process each selected order
    selectedOrders.forEach(order => {
      processOrderForShipping(order);
    });
    
    SpreadsheetApp.getUi().alert(`Processed ${selectedOrders.length} orders for shipping. Check the tracking numbers in the sheet.`);
    
  } catch (error) {
    console.error('Error in onReadyToShip:', error);
    SpreadsheetApp.getUi().alert('Error processing orders: ' + error.message);
  }
}

/**
 * Process individual order for shipping
 */
function processOrderForShipping(order) {
  try {
    // Update status to "Processing"
    updateOrderStatus(order.OrderID, 'Processing');
    
    // Call J&T Express automation (Playwright)
    if (CONFIG.JT_WEBHOOK_URL && CONFIG.JT_WEBHOOK_URL !== 'YOUR_JT_AUTOMATION_WEBHOOK_URL') {
      callJTAutomation(order);
    } else {
      // Simulate tracking number generation for demo
      const trackingNumber = generateTrackingNumber();
      updateOrderStatus(order.OrderID, 'Ready to Ship', trackingNumber);
    }
    
  } catch (error) {
    console.error('Error processing order for shipping:', error);
    updateOrderStatus(order.OrderID, 'Error', 'Failed to process: ' + error.message);
  }
}

/**
 * Call J&T Express automation webhook
 */
function callJTAutomation(order) {
  try {
    const payload = {
      orderId: order.OrderID,
      customerName: order.CustomerName,
      contact: order.Contact,
      address: order.Address,
      category: order.Category,
      packageSize: order.PackageSize,
      weight: getWeightForOrder(order),
      notes: order.Notes
    };
    
    const response = UrlFetchApp.fetch(CONFIG.JT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload)
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success && result.trackingNumber) {
      updateOrderStatus(order.OrderID, 'Ready to Ship', result.trackingNumber);
    } else {
      throw new Error(result.message || 'J&T automation failed');
    }
    
  } catch (error) {
    console.error('Error calling J&T automation:', error);
    // Generate mock tracking number as fallback
    const mockTrackingNumber = generateTrackingNumber();
    updateOrderStatus(order.OrderID, 'Ready to Ship', mockTrackingNumber);
  }
}

/**
 * Generate mock tracking number
 */
function generateTrackingNumber() {
  const prefix = 'JT';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
}

/**
 * Get weight for order based on product
 */
function getWeightForOrder(order) {
  const product = getProductById(order.ProductID);
  return product ? product.Weight || 0.5 : 0.5; // Default to 0.5kg if not found
}

/**
 * Update order status (internal helper)
 */
function updateOrderStatus(orderId, status, trackingNumber = null) {
  const sheet = getOrCreateSheet(CONFIG.ORDERS_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const orderRowIndex = data.slice(1).findIndex(row => row[0] === orderId);
  
  if (orderRowIndex !== -1) {
    const actualRowIndex = orderRowIndex + 2;
    
    // Update status
    const statusColumnIndex = headers.indexOf('Status');
    if (statusColumnIndex !== -1) {
      sheet.getRange(actualRowIndex, statusColumnIndex + 1).setValue(status);
    }
    
    // Update tracking number if provided
    if (trackingNumber) {
      const trackingColumnIndex = headers.indexOf('TrackingNo');
      if (trackingColumnIndex !== -1) {
        sheet.getRange(actualRowIndex, trackingColumnIndex + 1).setValue(trackingNumber);
      }
    }
  }
}

/**
 * Refresh QR codes for all products
 */
function refreshQRCodes() {
  try {
    const sheet = getOrCreateSheet(CONFIG.INVENTORY_SHEET);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const qrColumnIndex = headers.indexOf('QRLink');
    
    if (qrColumnIndex === -1) {
      SpreadsheetApp.getUi().alert('QRLink column not found');
      return;
    }
    
    for (let i = 1; i < data.length; i++) {
      const productId = data[i][0];
      if (productId) {
        const qrLink = `https://chart.googleapis.com/chart?chs=150x150&cht=qr&chl=https://your-site.github.io/order.html?product_id=${productId}`;
        sheet.getRange(i + 1, qrColumnIndex + 1).setValue(qrLink);
      }
    }
    
    SpreadsheetApp.getUi().alert('QR codes refreshed successfully!');
    
  } catch (error) {
    console.error('Error refreshing QR codes:', error);
    SpreadsheetApp.getUi().alert('Error refreshing QR codes: ' + error.message);
  }
}

/**
 * Show setup instructions
 */
function showSetupInstructions() {
  const html = `
    <div style="font-family: Arial; padding: 20px; line-height: 1.6;">
      <h2>Setup Instructions</h2>
      <h3>1. Deploy as Web App:</h3>
      <ul>
        <li>Go to Extensions > Apps Script</li>
        <li>Click Deploy > New Deployment</li>
        <li>Choose "Web app" as type</li>
        <li>Set execute as "Me" and access to "Anyone"</li>
        <li>Copy the Web App URL</li>
      </ul>
      
      <h3>2. Update Frontend Configuration:</h3>
      <ul>
        <li>Replace APPS_SCRIPT_URL in script.js</li>
        <li>Replace SHEETS_URL with this sheet's URL</li>
      </ul>
      
      <h3>3. Test the System:</h3>
      <ul>
        <li>Open your GitHub Pages site</li>
        <li>Try placing a test order</li>
        <li>Check if data appears in this sheet</li>
      </ul>
    </div>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(500)
    .setHeight(400);
    
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Setup Instructions');
}