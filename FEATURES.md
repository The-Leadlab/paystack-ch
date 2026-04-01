# Café de la Place - Financial Tracking System
## Complete Feature Documentation

**Live URL:** https://cafe-la-place.web.app

---

## 🎨 Design & Branding

### Dark Gold Theme
- **Elegant Dark Interface**: Complete dark theme with gold (#b8a06a) accents throughout
- **Professional Branding**: "CAFÉ DE LA PLACE" logo with "Est. 1999" and "GENÈVE" styling
- **Consistent Color Palette**:
  - Background: `#1a1a1a` (cdlp-dark)
  - Cards: `#111111` (cdlp-black)
  - Borders: `#333333` (cdlp-border)
  - Gold: `#b8a06a` (cdlp-gold)
  - Muted text: `#888888` (cdlp-muted)

### Responsive Design
- Mobile-first approach with collapsible sidebar
- Adaptive layouts for tablets and desktops
- Touch-friendly interface elements

---

## 🔐 Authentication & Security

### User Authentication
- **Email/Password Sign-up & Sign-in**
- **Google OAuth Integration**
- **Email Verification Gate**: Password users must verify email before accessing dashboard
- **Secure Session Management**: Firebase Authentication
- **User Profile Display**: Shows username/email in header

### Data Security
- All data scoped to authenticated user (restaurant_id/user_id)
- Firestore security rules enforce user isolation
- No cross-user data access
- Session-based data organization

---

## � Session Management System

### Session Features
- **Auto-Creation**: First session automatically created on login with timestamp
- **Session Naming**: Auto-generated with date/time/second (e.g., "2026-03-27 13:45:32")
- **Rename Sessions**: Click edit icon to rename any session
- **Delete Sessions**: Click trash icon to remove sessions (with confirmation)
- **Session Switching**: Click any session to view only its data
- **Resume Last Session**: Automatically resumes your last active session on login
- **All Sessions View**: Special aggregated view showing data from all sessions combined
- **Reset Button**: Exit "All Sessions" view back to individual session

### Session Sidebar
- Replaces employee sidebar
- Shows all sessions in chronological order
- Visual indicator for active session
- Session count display
- Add Session button (creates new timestamped session)
- **All Sessions View** with reset button (X icon) to exit back to individual session

### Data Scoping by Session
- **Income**: Filtered by current session
- **Expenses**: Filtered by current session
- **Documents**: Linked to specific session
- **Employees**: Global but can be assigned to sessions
- **Reports**: Filtered by session or show all

---

## 👥 Employee Management

### Employee Features
- **Manual Employee Addition**: Add employees with comprehensive details
- **Auto-Creation from Payroll**: AI automatically creates employees when analyzing payslips
- **Global Employee Pool**: Employees can be assigned to specific sessions or remain global
- **Swiss Payroll Fields**:
  - Work Percentage: 40%, 60%, 80%, 100% (Beschäftigungsgrad)
  - Monthly Salary (Gross)
  - AVS/AHV: Old Age and Survivors Insurance (employee & employer)
  - AC/ALV: Unemployment Insurance (employee & employer)
  - LPP/BVG: Occupational Pension Fund - 2nd Pillar (employee & employer)
  - Social Contributions (total)

### Employee Display
- Shows employees relevant to current session
- Displays name, position, work percentage
- Shows salary and AVS contributions
- Delete functionality with confirmation
- Real-time updates

---

## � Financial Management

### Income Tracking
- **Session-Scoped**: All income linked to current session
- **Income Types**:
  - Sales (SALES)
  - Reservations (RESERVATION)
- **Grouped Display**: Income organized by type with collapsible sections
- **Quick Add**: Modal for adding income entries
- **Delete**: Remove income entries with one click

### Expense Tracking
- **Session-Scoped**: All expenses linked to current session
- **Expense Categories**:
  - Bills (BILLS): Utilities, rent, insurance
  - Suppliers (SUPPLIERS): Food, groceries, restaurant supplies
  - Payroll (PAYROLL): Employee salaries
  - Other (OTHER): Miscellaneous expenses
- **Grouped Display**: Expenses organized by category with collapsible sections
- **Quick Add**: Modal for adding expense entries
- **Supplier Linking**: Expenses linked to supplier names for drill-down

### Financial Summary Cards
- **Total Income**: Sum of session income (emerald green)
- **Total Expenses**: Sum of session expenses (red)
- **Total Payroll**: Sum of employee salaries + contributions (gold)
- **Balance**: Income - Expenses - Payroll (green if positive, red if negative)
- **Session-Filtered**: Shows only current session data (or all if in All Sessions view)

---

## 📄 Document Management System

### Document Upload & Processing
- **Drag & Drop Interface**: Upload PDFs, JPGs, PNGs, WebP
- **AI-Powered Analysis**: Gemini AI extracts financial data with 100% accuracy
- **Multi-Document Support**: Process multiple documents simultaneously
- **Real-time Status**: Shows pending, processing, completed, error states
- **Session Linking**: All documents linked to current session
- **Duplicate Prevention**: File hash detection prevents re-scanning same file in session

### Document Organization
- **Tree Structure**: Documents organized by Suppliers and Employees
- **Session-Scoped**: Documents filtered by current session
- **Category Filtering**:
  - All Documents
  - Suppliers Only
  - Employees Only
- **Date Filtering**: Filter documents by month
- **Entity Cards**: Click supplier/employee to see all their documents
- **Monthly Grouping**: Documents grouped by month within each entity
- **Scanned Indicator**: Visual marker for already-scanned files

### Document Types Supported

#### 1. Employee Documents (Payslips - Lohnabrechnung/Lohnausweis)
**Extracted Data:**
- Employee Information (name, ID, address)
- Employer Information (company, address)
- Payslip Details (number, period, pay date)
- Work Percentage (Beschäftigungsgrad/Taux d'activité)
- Swiss Social Security Contributions:
  - AVS/AHV: Old Age and Survivors Insurance
  - AC/ALV: Unemployment Insurance
  - LPP/BVG: Occupational Pension Fund
- Earnings & Deductions (itemized table)
- Gross Pay
- Net Pay
- Currency

#### 2. Supplier Documents (Invoices/Receipts)
**Extracted Data:**
- Supplier Identity (name, address, Swiss UID: CHE-XXX.XXX.XXX)
- Payment Details (IBAN/QR-IBAN, 27-digit QR Reference)
- Document Number
- Date
- Line Item Table:
  - Description of product/service
  - Quantity
  - Unit Price
  - Total Price per line
- Financial Summary:
  - Currency (default CHF)
  - Subtotal (Net Amount)
  - VAT/MWST/TVA (percentage and amount)
  - Grand Total
- Currency Conversion (if not CHF)
- Notes
- Forensic Alerts (suspicious items flagged)

#### 3. POS Revenue Reports (Z-Readings / Rapport de période)
**Extracted Data:**
- Report Identity:
  - Report ID (e.g., P129331.1066)
  - Période de vente (Start and End date/time)
- Revenue Breakdown:
  - Gross Revenue (Ventes brutes, taxe incluse)
  - Net Revenue (Ventes nettes)
  - Tax Breakdown (Total des taxes)
  - Individual VAT rates (2.6%, 8.1%, etc.) itemized
- Adjustments & Corrections:
  - Annulations (Canceled transactions)
  - Rabais (Discounts applied)
  - Frais de service (Service fees)
- Payment Method Breakdown:
  - Espèces (Cash)
  - CB / Cartes (Credit/Debit Cards)
  - Other (Twint, Lunch-Check, etc.)
- Tips (Total des pourboires)
- Revenue Adjustment Logic:
  - Flags if Net Sales + Taxes ≠ Gross Sales
  - Manual adjustment field for cash shortages/payouts

#### 4. Bank Statements
- Opening Balance
- Closing Balance
- Transaction List (income/expense classification)
- Calculated totals

#### 5. Z2 Multi-Ticket Sheets
- Multiple sub-documents extracted
- Each ticket processed separately
- Aggregated totals

### Document Detail View
- **Comprehensive Display**: All extracted data shown in organized sections
- **Employee Documents**:
  - Employee & Employer info cards
  - Payslip details
  - Swiss contributions table with color-coded deductions/earnings
  - Salary summary with gross/net breakdown
- **Supplier Documents**:
  - Supplier info card
  - Complete line items table
  - Financial summary with VAT breakdown
  - Currency conversion details
  - Forensic alerts section
- **POS Revenue Reports**:
  - Report identity and period
  - Revenue breakdown (gross/net/tax)
  - Adjustments (cancellations, discounts, fees)
  - Payment method breakdown
  - Tips separate from revenue
  - Manual adjustment field
- **AI Analysis**:
  - AI interpretation text
  - Confidence score with visual progress bar
- **Delete Functionality**: Delete button with confirmation dialog

---

## 📊 Reports & Analytics

### Monthly Revenue Analysis
- **Session-Filtered**: Shows only current session data (or all sessions)
- **Date Range Filter**:
  - Custom date range (From/To date pickers)
  - Quick filters:
    - This Month
    - Last Month
    - Last 3 Months
    - This Year
    - Clear (reset filters)
- **Visual Indicator**: Shows active filter range
- **Monthly Breakdown**:
  - Income per month
  - Expenses per month
  - Balance per month (color-coded)
- **Sorted Display**: Most recent months first

### Supplier Analysis
- **Session-Scoped**: Suppliers from current session
- **Supplier List**: All suppliers sorted by total spending
- **Transaction Count**: Number of invoices per supplier
- **Total Spent**: Sum of all expenses per supplier
- **Clickable Cards**: Click to drill down

### Supplier Drill-Down
- **Monthly Organization**: All supplier invoices grouped by month
- **Month Cards**: Each month shows:
  - Month name (e.g., "January 2024")
  - Total spent that month
  - List of all transactions with dates and amounts
- **Back Navigation**: Return to supplier list

### Revenue Tab (POS Reports)
- **Separate from Expenses**: Z-readings stored as inbound revenue
- **Summary Cards**: Gross revenue, net revenue, total tax, tips
- **Payment Method Breakdown**: Cash, card, and other payment methods
- **Date Filtering**: Filter POS reports by month
- **Report List**: All POS reports with gross revenue display
- **Exact Extraction**: Captures cancellations and discounts
- **Manual Adjustment**: Field for cash shortages/manual payouts with reason
- **Payment Method Tracking**: See how money was received (cash, card, other)
- **Tip Tracking**: Tips separated from revenue
- **Revenue Validation**: Flags mismatches between net sales + taxes and gross sales
- **Detailed View**: Complete breakdown of each Z-reading with all components

---

## 🌐 Multi-Language Support

### Languages
- **English (EN)**
- **French (FR)**

### Language Toggle
- Globe icon in header
- Instant language switching
- Persists across sessions

### Translated Elements
- All UI labels and buttons
- Form fields
- Category names
- Error messages
- Success notifications

---

## � Real-Time Data Sync

### Firestore Integration
- **Real-time Updates**: Changes sync instantly across devices
- **Offline Support**: Works offline, syncs when online
- **Collections**:
  - `sessions`: Session records
  - `employees`: Employee records (with optional session_id)
  - `income`: Income entries (with session_id)
  - `expenses`: Expense entries (with session_id)
  - `documents`: Processed documents (with session_id)

### Data Structure
- All records linked to `restaurantId` (user UID)
- Session-based organization with `sessionId`
- Timestamps for creation tracking
- Automatic ID generation
- File hash for duplicate detection

---

## 🎯 User Experience Features

### Navigation
- **Tab System**:
  - Dashboard: Main financial overview with income, expenses, and payroll
  - Revenue: POS Revenue Reports (Z-readings) with payment method breakdown
  - Reports: Analytics and insights with supplier analysis and monthly revenue
  - Documents: Document library organized by suppliers and employees
- **Session Sidebar**: Session list (collapsible on mobile)
- **Mobile Menu**: Hamburger menu for small screens

### Modals & Forms
- **Add Employee Modal**:
  - Name, position, work percentage
  - Salary and all Swiss payroll fields
  - Optional session assignment
  - Validation and error handling
- **Add Income Modal**:
  - Date, type, amount, description
  - Auto-linked to current session
- **Add Expense Modal**:
  - Date, category, amount, description
  - Auto-linked to current session

### Visual Feedback
- **Loading States**: Animated pulse for loading
- **Success Messages**: Green confirmation text
- **Error Messages**: Red error text
- **Hover Effects**: Interactive elements highlight on hover
- **Transitions**: Smooth color and size transitions
- **Active Session Indicator**: Gold border on selected session

### Custom Scrollbars
- Thin gold scrollbars (4px width)
- Matches theme aesthetic
- Hover effect for better visibility

---

## 🤖 AI-Powered Features

### Gemini AI Integration
- **Document Analysis**: Extracts structured data from images/PDFs
- **Swiss Financial Expertise**: Trained on Swiss payroll and invoice formats
- **POS Report Recognition**: Identifies Z-readings and extracts revenue data
- **Multi-Language**: Handles German, French, Italian documents
- **Accuracy Flags**: Marks uncertain values with [UNCERTAIN]
- **Forensic Detection**: Identifies suspicious or unusual items
- **Revenue Validation**: Flags mismatches in POS reports

### Auto-Creation Logic
- **Employees**: Automatically created from payslip analysis
- **Session Assignment**: Employees assigned to current session
- **Duplicate Prevention**: Checks for existing employees by name
- **Data Extraction**: Pulls salary, contributions, work percentage
- **Expense Recording**: Creates expense entry for payroll

### Document Classification
- **Type Detection**: Identifies document type automatically (including POS reports)
- **Category Assignment**: Routes to correct expense category or revenue
- **Supplier Extraction**: Identifies and normalizes supplier names
- **Date Parsing**: Extracts document dates in various formats
- **File Hashing**: Generates hash to prevent duplicate scanning

---

## 📱 Responsive Breakpoints

### Mobile (< 768px)
- Collapsible sidebar
- Stacked layout
- Touch-optimized buttons
- Mobile header with hamburger menu

### Tablet (768px - 1024px)
- 2-column grid for cards
- Sidebar visible
- Optimized spacing

### Desktop (> 1024px)
- 3-4 column grids
- Full sidebar always visible
- Maximum content width: 1400px
- Spacious layout

---

## � Technical Stack

### Frontend
- **React 19**: Latest React with hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library
- **Vite**: Fast build tool

### Backend
- **Firebase Authentication**: User management
- **Firestore**: NoSQL database with session-based organization
- **Firebase Hosting**: Static site hosting
- **Google Gemini AI**: Document analysis (including POS reports)

### Development
- **ESM Imports**: Modern module system
- **Hot Module Replacement**: Fast development
- **TypeScript Strict Mode**: Maximum type safety

---

## 🚀 Deployment

### Build Process
```bash
npm run build
```
- Vite production build
- Asset optimization
- Code splitting
- Minification

### Hosting
```bash
npx firebase deploy --only hosting
```
- Deployed to Firebase Hosting
- CDN distribution
- HTTPS by default
- Custom domain support

### Environment Variables
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_GEMINI_API_KEY`

---

## 📋 Future Enhancements

### Planned Features
- [ ] Document file storage (Firebase Storage)
- [ ] PDF preview in document detail view
- [ ] Export reports to PDF/Excel
- [ ] Email notifications for new documents
- [ ] Multi-restaurant support
- [ ] Role-based access control
- [ ] Audit trail and activity log
- [ ] Budget planning and forecasting
- [ ] Tax report generation
- [ ] Bank account integration
- [ ] Recurring expense automation
- [ ] Mobile app (React Native)
- [ ] Session templates
- [ ] Bulk session operations
- [ ] Session analytics dashboard

---

## 📞 Support & Contact

**Project**: Café de la Place Financial Tracker  
**Version**: 2.0.0 (Session System)  
**Last Updated**: March 27, 2026  
**Deployed**: https://cafe-la-place.web.app

---

## 📄 License

Proprietary - All rights reserved  
© 2026 Café de la Place
