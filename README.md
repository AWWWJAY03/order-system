# 🛍️ Order & Shipping Management System

A complete, **100% free-to-deploy** order and shipping management web application that enables customers to order products via QR codes, pay using GCash, and automates J&T Express shipping bookings.

## 🌟 Features

- **QR Code Ordering**: Each product gets a unique QR code for instant ordering
- **GCash Payment Integration**: Local QRPH.png QR image for payment
- **Automated Inventory Management**: Real-time stock updates via Google Sheets
- **J&T Express Automation**: Automated booking using Playwright browser automation
- **100% Free Hosting**: Frontend on GitHub Pages, backend on Google Apps Script
- **Mobile-Responsive Design**: Works perfectly on all devices
- **Real-time Order Tracking**: Complete order lifecycle management

## 🏗️ System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Customer      │    │   GitHub Pages   │    │ Google Sheets   │
│   (QR Scan)     │───▶│   (Frontend)     │───▶│   (Database)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GCash QR      │    │ Google Apps      │    │   J&T Express   │
│   (Payment)     │    │ Script (API)     │───▶│   (Shipping)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Clone & Deploy

```bash
git clone https://github.com/YOUR_USERNAME/order-system.git
cd order-system
```

### 2. Set Up Google Sheets

1. Create a new Google Sheet
2. Copy the Apps Script code from `backend/Code.gs`
3. Deploy as a web app with public access
4. Note down your Apps Script URL

### 3. Configure Frontend

Update `frontend/script.js`:
```javascript
const CONFIG = {
    APPS_SCRIPT_URL: 'YOUR_APPS_SCRIPT_URL_HERE',
    SHEETS_URL: 'YOUR_GOOGLE_SHEET_URL_HERE'
};
```

### 4. Replace Payment QR

Replace `frontend/QRPH.png` with your actual GCash QR code image.

### 5. Deploy to GitHub Pages

Push to GitHub and enable Pages in repository settings.

## 📊 Google Sheets Structure

### Inventory Sheet
| Column | Description | Example |
|--------|-------------|---------|
| ProductID | Unique identifier | PROD001 |
| Name | Product name | Wireless Headphones |
| Description | Product description | High-quality wireless headphones |
| Category | Product category | Electronics |
| PackageSize | Shipping size | Medium |
| Price | Product price | 2499.99 |
| Stock | Available quantity | 50 |
| Weight | Package weight (kg) | 0.3 |
| QRLink | Generated QR code URL | (auto-generated) |

### Orders Sheet
| Column | Description | Example |
|--------|-------------|---------|
| OrderID | Unique order ID | ORD1697123456789001 |
| ProductID | Referenced product | PROD001 |
| ProductName | Product name | Wireless Headphones |
| Category | Product category | Electronics |
| PackageSize | Package size | Medium |
| Price | Order amount | 2499.99 |
| CustomerName | Customer name | Juan Dela Cruz |
| Contact | Phone number | 09123456789 |
| Address | Shipping address | 123 Main St, City |
| Notes | Special instructions | Handle with care |
| Status | Order status | Pending Payment |
| PaymentRef | Payment reference | (manual entry) |
| TrackingNo | J&T tracking number | JT1234567890 |
| Date | Order timestamp | 2024-10-19T10:30:00.000Z |

## 🔧 Setup Instructions

### Google Apps Script Setup

1. Open [Google Apps Script](https://script.google.com)
2. Create a new project
3. Replace `Code.gs` content with our backend code
4. Save and deploy as web app:
   - Execute as: "Me"
   - Who has access: "Anyone"
5. Copy the web app URL

### Google Sheets Configuration

1. Create a new Google Sheet
2. The script will auto-create "Inventory" and "Orders" sheets
3. Add sample products or import your inventory
4. Share the sheet with your Apps Script project

### J&T Express Automation (Optional)

1. Set up a server to run the Playwright automation:
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your J&T credentials
npm start
```

2. Update the webhook URL in your Google Apps Script

### GitHub Pages Deployment

1. Fork or create a new repository
2. Enable GitHub Pages in Settings > Pages
3. Set source to "GitHub Actions"
4. Push your code to trigger automatic deployment

## 💳 Payment Integration

### Setting up GCash QR

1. Generate your GCash QR code from the GCash app
2. Save it as `QRPH.png` in the `frontend/` directory
3. The payment page will display this QR for customers

### Payment Workflow

1. Customer places order
2. System shows GCash QR code
3. Customer pays via GCash app
4. Admin manually confirms payment
5. Order status updates to "Ready to Ship"

## 🚚 Shipping Automation

### J&T Express Integration

The system automates J&T Express bookings using Playwright:

1. Admin selects orders in Google Sheets
2. Clicks "Ready to Ship" from custom menu
3. Playwright automates J&T portal booking
4. Tracking numbers are captured and updated

### Manual Shipping

Without automation, admins can:
1. Manually book shipments on J&T portal
2. Update tracking numbers in Google Sheets
3. Customers receive tracking information

## 🛠️ Development

### Local Development

```bash
# Frontend (serve static files)
cd frontend
python -m http.server 8000

# Backend automation server
cd backend
npm install
npm run dev
```

### Testing

```bash
# Test backend syntax
cd backend
npm test

# Test frontend JavaScript
node -c frontend/script.js
```

## 📱 Customer Journey

1. **Discovery**: Customer scans product QR code
2. **Ordering**: Fills order form with shipping details
3. **Payment**: Pays using GCash QR code
4. **Confirmation**: Receives order confirmation
5. **Shipping**: Admin processes and ships order
6. **Tracking**: Customer tracks shipment via J&T

## 🔒 Security & Privacy

- All data stored in your Google Sheets
- HTTPS encryption for all communications
- No sensitive data stored in frontend
- Optional authentication for admin functions

## 🌐 Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (iOS/Android)

## 📞 Support & Troubleshooting

### Common Issues

**Products not loading?**
- Check Apps Script URL in `script.js`
- Verify Google Sheets permissions
- Check browser console for errors

**Orders not saving?**
- Verify Apps Script deployment
- Check CORS settings
- Ensure Google Sheets is accessible

**J&T automation failing?**
- Check login credentials in `.env`
- Verify J&T portal structure hasn't changed
- Check server logs for detailed errors

### Debug Mode

Enable console logging by adding to `script.js`:
```javascript
const DEBUG = true;
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Apps Script for free backend hosting
- GitHub Pages for free frontend hosting
- Playwright for browser automation
- J&T Express for shipping services
- GCash for payment integration

## 📈 Roadmap

- [ ] Multiple payment options (PayMaya, bank transfer)
- [ ] SMS notifications for customers
- [ ] Advanced inventory analytics
- [ ] Multi-store support
- [ ] Customer loyalty program
- [ ] Automated email receipts

## 🎯 Use Cases

Perfect for:
- Small e-commerce businesses
- Local retailers with delivery
- Event merchandise sales
- Dropshipping operations
- Pop-up stores
- Online marketplaces

---

## 🚀 Live Demo

Visit the live demo at: `https://YOUR_USERNAME.github.io/order-system/`

**Test Product QR Codes:**
- Scan any product QR from the main page
- Try the complete order flow
- View orders in the Google Sheets

**Admin Access:**
- Open the Google Sheets link from the main page
- Test the "Ready to Ship" functionality
- Monitor real-time order data

---

*Built with ❤️ for small businesses looking to digitize their operations without breaking the bank.*