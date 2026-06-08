# CampusEats

CampusEats is a full-local, QR-based restaurant ordering web application built for a graduation project demo. It lets customers scan fixed table QR codes, browse a mobile-first digital menu, place orders, call a waiter, request payment approval, and follow order status in real time. Admins manage restaurants and restaurant managers, while restaurant managers manage tables, QR codes, menus, orders, payment confirmations, support requests, and dashboard statistics.

> **GitHub Description:** Full-local QR-based restaurant ordering web app for campus dining, with fixed table QR codes, admin/manager panels, live orders, payment approval, PWA support, TR/EN language, dark mode, and local SQLite.

---

## Project Scope

CampusEats is designed as a **local web app**. It does not use Firebase or any external cloud database. The frontend, backend, database, QR generation, file uploads, image processing, live updates, authentication, admin panel, manager panel, customer menu, PWA support, and demo data all run locally.

The system is built for a jury/demo environment where the whole project can run from one machine with:

- React frontend
- Node.js / Express backend
- SQLite local database
- Socket.IO real-time updates
- Local QR code generation
- Local image upload and resize pipeline
- Optional Progressive Web App installation

---

## Main Features

### Full Local Operation

- No Firebase.
- No external database server.
- No cloud storage.
- SQLite database is created locally under `server/data/campuseats.sqlite`.
- Uploaded menu images are stored locally under `server/public/uploads/menu`.
- React build can be served by the Express backend for production-like local usage.
- Development mode runs frontend and backend together with one command.

### User Roles

CampusEats has three main user flows:

1. **System Admin**
2. **Restaurant Manager**
3. **Customer**

Customers do not need an account. They access the menu directly through the table QR code.

---

## Technology Stack

### Frontend

- React
- Vite
- React Router
- Socket.IO Client
- Lucide React icons
- CSS custom properties for light/dark theme
- LocalStorage for persistent user preferences and customer cart state
- PWA manifest and service worker

### Backend

- Node.js
- Express.js
- Socket.IO
- SQLite with `better-sqlite3` `^12.10.0`
- JWT authentication
- bcrypt password hashing
- Zod request validation
- Multer file upload handling
- Sharp image processing
- QRCode library for QR image generation
- Helmet, CORS, Morgan

### Database

- SQLite local database
- Database file: `server/data/campuseats.sqlite`
- WAL mode enabled
- Foreign key support enabled

---

## Installation

### 1. Extract the project correctly

After extracting the zip or cloning the repository, the root folder must contain these files/folders directly:

```text
CampusEats/
├── package.json
├── README.md
├── server/
│   └── package.json
└── client/
    └── package.json
```

If `server/package.json` or `client/package.json` is missing, the project was extracted incorrectly.

### 2. Install all dependencies

```bash
npm run install:all
```

This installs root, server, and client dependencies.

### 3. Start development mode

```bash
npm run dev
```

Default local addresses:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:4000
```

---

## Available Scripts

From the root folder:

```bash
npm run install:all
```

Installs root, backend, and frontend dependencies.

```bash
npm run dev
```

Runs backend and frontend together in development mode.

```bash
npm run build
```

Builds the React frontend.

```bash
npm start
```

Starts the Express backend. After `npm run build`, the backend can serve the built frontend files.

From the server folder:

```bash
npm --prefix server run reset-db
```

Deletes and recreates the local demo database with seeded demo data.

---

## Demo Accounts

### System Admin

```text
Email: admin@local.test
Password: admin123!
```

### Restaurant Manager

```text
Email: manager@local.test
Password: manager123!
```

### Password Rule

Passwords must include:

- At least 6 characters
- At least 1 number
- At least 1 special character

Examples:

```text
admin123!
manager123!
```

---

## Seeded Demo Data

When the database is created for the first time, CampusEats seeds demo content automatically:

- Demo restaurant: `CampusEats Demo`
- Demo restaurant slug: `campus-eats`
- System admin account
- Restaurant manager account
- 8 demo tables
- Initial menu categories:
  - Mains
  - Appetizers
  - Drinks
  - Desserts
- Initial menu items:
  - Classic Burger
  - Margherita Pizza
  - Carbonara Pasta
  - Crispy Fries
  - Caesar Salad
  - Iced Lemonade
  - Turkish Coffee
  - Cheesecake

---

## Main Demo Flow

1. Start the project with `npm run dev`.
2. Open `http://localhost:5173`.
3. Log in as the restaurant manager.
4. Go to **Tables & QR**.
5. Select a table and open or copy its QR link.
6. Customer menu opens through a URL like:

```text
/r/campus-eats/table/<table-token>
```

7. Customer adds products to the cart.
8. Customer confirms the order.
9. Order appears in the manager panel in real time.
10. Manager changes order status:

```text
Pending → Preparing → Ready → Served
```

11. After the order is served, the customer can request payment approval.
12. Customer selects a payment method:

```text
Cash / Card / Transfer
```

13. Manager sees the payment confirmation template.
14. Manager approves or rejects the payment.
15. If approved, the order is completed and the table is cleared.
16. The same fixed QR code can be reused for the next customer.

---

## System Admin Features

The System Admin manages the system-level restaurant and manager records.

### Restaurant Management

- Create restaurants.
- View all restaurants.
- Edit restaurant information:
  - Restaurant name
  - Address
  - Phone number
- Delete restaurants.
- When a restaurant is deleted, its assigned restaurant manager accounts are deleted with it.
- Restaurant slug remains fixed after creation so old QR codes do not break when the restaurant name is edited.
- Restaurant list shows manager count and table count.

### Restaurant Manager Management

- Create restaurant manager accounts.
- Assign a manager to a restaurant.
- Edit manager information:
  - Name
  - Email
  - Password
  - Assigned restaurant
- Delete manager accounts.
- Manager creation form does not use a default/demo password.
- Admin must manually enter the manager password.

### Admin Validation

- Browser default validation is disabled for custom site validation.
- Invalid fields are shown inside the UI.
- Error messages follow the selected page language.
- Email format is checked.
- Phone number format is checked.
- Password rule is checked.
- Duplicate email is handled with a clear message.

---

## Restaurant Manager Features

The Restaurant Manager controls the restaurant operation.

### Manager Dashboard

The dashboard displays restaurant statistics such as:

- Today’s approved revenue
- Today’s order count
- Active orders
- Waiting payment approvals
- Daily revenue list
- Best-selling menu items
- Latest orders
- Restaurant information

### Restaurant Context Display

The manager panel clearly shows which restaurant the manager is assigned to. If an admin changes a manager’s restaurant assignment, the manager panel refreshes the stored restaurant context after loading the dashboard.

### Real-Time Updates

The manager panel listens for Socket.IO events and refreshes relevant data when changes happen:

- New orders
- Order updates
- Table updates
- Menu updates
- Support requests

---

## Table and QR Management

Each restaurant manager can manage the restaurant’s tables and QR codes.

### Table Features

- Create tables.
- Edit table number.
- Edit chair count / table capacity.
- Activate or deactivate tables.
- Delete tables.
- Clear active table order.
- Regenerate QR token.
- View table status:
  - Clean
  - Active order
  - Active/passive table
  - Chair count

### Fixed QR Code Logic

Each table has a fixed QR code based on a unique table token.

Example customer URL:

```text
http://localhost:5173/r/campus-eats/table/<table-token>
```

Important QR behavior:

- QR codes are generated once per table.
- The QR token is random and not based directly on the visible table number.
- The same QR code is reused after payment is completed.
- When payment is approved, the QR code itself is not changed.
- Only the table’s active order/session state is cleared.
- QR can be regenerated manually if needed.
- QR regeneration is blocked while the table has an active order.
- Table deletion is blocked while the table has an active order.

### QR Tools

- QR preview in manager panel.
- QR image generation as data URL.
- QR download button.
- QR link copy button.
- Fixed QR explanation shown in the UI.

---

## Menu Management

The manager can manage categories and menu items from the restaurant panel.

### Category Features

- Create categories.
- Edit category name.
- Edit category sort order.
- Activate or deactivate categories.
- Delete categories.
- Category deletion is blocked if the category still has menu items.
- Public customer menu only shows active categories.

### Menu Item Features

- Create menu items.
- Edit menu item information:
  - Category
  - Emoji fallback
  - Name
  - Description
  - Price
  - Availability
  - Image
- Delete menu items.
- Toggle item availability.
- Upload or replace item image.
- Public customer menu only shows available menu items.
- Item information is snapshotted into the order when the order is placed, so old order history does not break if the menu item is edited later.

---

## Image Upload and Resize

CampusEats supports local menu item image uploads.

### Upload Rules

- Only image MIME types are accepted.
- Maximum upload size is 5 MB.
- Images are processed on the backend with Sharp.
- Invalid image files are rejected.
- Images are stored locally in:

```text
server/public/uploads/menu
```

### Resize Rules

Uploaded menu images are automatically processed:

- Converted to WebP.
- Resized to fit inside `900x900`.
- Aspect ratio is preserved.
- Images are not enlarged unnecessarily.
- WebP quality is set to `88`.
- EXIF rotation is respected with `.rotate()`.

### Cleanup Behavior

- If an item image is replaced, the previous local image file is deleted.
- If a menu item is deleted, its local image file is deleted.

---

## Customer Features

Customers do not need to create an account or log in.

### Customer QR Flow

- Customer scans the table QR code.
- The app automatically identifies the restaurant and table.
- Customer sees the mobile-first restaurant menu.
- Customer can search menu items.
- Customer can filter items by category.
- Customer can add products to the cart.
- Customer can increase/decrease quantities.
- Customer can add special notes to order items.
- Customer can view subtotal, tax, and total.
- Customer can confirm the order.
- Customer can track the order status.
- Customer can call the waiter.
- Customer can add more items to the active order before payment starts.
- Customer can request payment approval after the order is served.

### Customer Cart Persistence

The customer cart is saved in `localStorage` using the restaurant slug and table token.

This means:

- If the browser is refreshed, the cart can remain available.
- The cart is separated by QR/table.
- Opening a different table QR does not mix the cart with the previous table.
- Cart data is cleared after order submission.

### Add More Items Flow

If a table already has an active order:

- Normal QR opening redirects the customer to the active order status page.
- The customer can use **Add more items / Yeni ürün ekle** from the order status page.
- Add-more mode opens the same menu with append behavior.
- Additional items are added to the existing active order.
- Adding more items is blocked after payment has started.

---

## Order Management

### Order Statuses

CampusEats uses the following order statuses:

```text
PENDING
PREPARING
READY
SERVED
PAYMENT_WAITING
PAYMENT_REJECTED
PAYMENT_APPROVED
COMPLETED
CANCELLED
```

### Payment Statuses

CampusEats uses the following payment statuses:

```text
NOT_REQUESTED
WAITING_APPROVAL
APPROVED
REJECTED
```

### Manager Order Actions

The manager can move orders through the preparation flow:

```text
Pending → Preparing → Ready → Served
```

The manager can also cancel an order.

The manager cannot manually start payment waiting from the manager panel. Payment waiting can only start after the customer requests payment.

### Order Number Logic

- Orders use database IDs to generate stable order numbers.
- Format example:

```text
#00001
#00002
#00003
```

This avoids using a simple `COUNT + 1` order number calculation.

### Order Totals and Tax

- Customer cart shows subtotal, tax, and total.
- Backend calculates the same tax and total again when the order is submitted.
- Tax rate is `10%`.
- Backend stores the tax-included total in the order.
- Manager and customer see the same total.

---

## Payment Approval Flow

CampusEats uses a local payment approval template system instead of a real payment gateway.

### Payment Flow

The intended payment flow is:

```text
Customer places order
→ Manager marks order as Served
→ Customer selects payment method
→ Payment request/template is created
→ Manager approves or rejects payment
→ Approved payment completes order
→ Table is cleared
→ Same QR code becomes reusable
```

### Supported Payment Methods

```text
CASH
CARD
TRANSFER
```

### Payment Template

When the customer requests payment, the backend creates a payment template with:

- Restaurant name
- Table number
- Order number
- Total amount
- Payment method
- Waiting approval status

The manager sees this template in the order card and can approve or reject it.

### Payment Protection Rules

- Customer can request payment only after the order is `SERVED`.
- Customer can request payment again if the previous payment was rejected.
- Manager cannot approve an order unless a waiting payment request exists.
- Manager cannot approve payment before the customer creates the payment request.
- Payment approval requires the order to be in `PAYMENT_WAITING` state.
- Payment approval requires payment status to be `WAITING_APPROVAL`.
- Payment approval requires a valid customer-selected method: `CASH`, `CARD`, or `TRANSFER`.
- Orders can be completed only after payment approval.
- When payment is approved, the order becomes `COMPLETED` and payment becomes `APPROVED`.
- When payment is approved, the table is cleared only if that table is still connected to the same current order.
- If payment is rejected, the order becomes `PAYMENT_REJECTED` and payment becomes `REJECTED`.
- Rejected payments can be requested again by the customer.

---

## Waiter Call and Support Requests

CampusEats includes a support request system for customer assistance.

### Customer Waiter Call

Customers can call a waiter from:

- Menu screen
- Order status screen

A customer can include a support note/message.

### Support Request Types

```text
WAITER
QR_HELP
```

### Manager Support Panel

The manager can:

- View open support requests.
- See request type.
- See table number if available.
- See the customer message.
- Mark support requests as done.
- See support notifications update in real time.

### Waiter Call Cooldown

To prevent spam in the demo flow, CampusEats uses a local cooldown:

- Cooldown duration: **60 seconds**
- Cooldown storage: `localStorage`
- Cooldown key includes:
  - Restaurant slug
  - Table token
  - Request type

This means repeated waiter calls from the same browser/table/type are blocked for 60 seconds.

### Duplicate Open Request Protection

The backend also checks for existing open requests:

- If the same table already has an open request of the same type, the system returns the existing request instead of creating a duplicate.
- This protects the manager panel from repeated open support cards.

---

## Invalid QR Handling

If a QR code is invalid or a QR URL is wrong, the customer is not redirected to admin or manager login.

Instead, the app shows a dedicated invalid QR page.

### Invalid QR Page Features

- Shows a clear invalid QR message.
- Lets the customer enter the table number.
- Lets the customer write a support note.
- Sends a `QR_HELP` support request.
- Uses site validation instead of browser validation.
- Supports Turkish and English UI text.
- Shows a confirmation after support is sent.

### QR Help Fallback

If the QR slug is wrong, the system can still send the QR help request to the first available local restaurant in the demo database. This helps the jury/demo flow because a broken QR can still produce a visible support request in the manager panel.

---

## Theme and Language

CampusEats supports both language and theme customization.

### Languages

- Turkish
- English

### Themes

- Light theme
- Dark theme

### Preference Persistence

Theme and language selections are stored in `localStorage`.

This means preferences remain active after:

- Browser refresh
- Closing and reopening the browser
- Opening a new QR link
- Moving between customer, admin, and manager screens

### UI Controls

- Language and theme controls use segmented buttons instead of basic select boxes.
- Customer-side controls are placed as a small floating control in the top-right area.
- Admin/manager controls are available through the application shell.
- An early theme script in `index.html` applies the saved theme before React loads, reducing light/dark flash during page load.

---

## PWA Support

CampusEats can be used as an installable Progressive Web App.

### PWA Files

```text
client/public/manifest.json
client/public/sw.js
```

### PWA Features

- App name: CampusEats Local
- Short name: CampusEats
- Standalone display mode
- Theme color configured
- SVG app icon
- Service worker registration
- App shell caching
- Static asset caching for assets/icons/manifest
- Fetch fallback to cached content when available

The PWA support is intended for a local/demo installable web app experience.

---

## Authentication and Session Behavior

### Admin and Manager Login

- Admin and restaurant managers log in with email/password.
- Login returns a JWT token.
- JWT token expires after 8 hours.
- Passwords are hashed with bcrypt.
- Stored frontend auth state uses `localStorage`.
- Authenticated API routes require a Bearer token.

### Role-Based Access

- Admin routes require `ADMIN` role.
- Manager routes require `RESTAURANT_MANAGER` role.
- Manager routes require the manager to be assigned to a restaurant.
- Manager operations are scoped to the assigned restaurant.
- Customers do not use JWT login.

---

## Validation and Protection Methods

CampusEats includes several validation and protection mechanisms suitable for a graduation project demo.

### Form Validation

- Site-level validation is used instead of relying only on browser validation.
- Admin add/edit forms use custom validation.
- Manager table/category/menu forms use custom validation.
- Invalid fields are shown near the related field.
- Backend validation uses Zod.
- Backend validation responses include field-level errors where possible.
- Error messages follow the active language when supported.

### Email Validation

- Emails are trimmed and lowercased.
- Invalid email format is rejected.
- Duplicate email addresses are rejected.

### Phone Validation

Phone numbers are validated with a flexible phone pattern supporting:

- Optional `+`
- Spaces
- Parentheses
- Dots
- Dashes
- 7 to 20 practical characters

### Password Validation

Passwords must include:

- Minimum 6 characters
- At least 1 number
- At least 1 special character

### Restaurant and Manager Protection

- Only admins can create/edit/delete restaurants.
- Only admins can create/edit/delete manager accounts.
- Deleting a restaurant also deletes its restaurant manager accounts.
- Restaurant slug remains fixed after restaurant edits to avoid breaking QR links.

### Table and QR Protection

- Table tokens are generated randomly.
- QR links use table tokens instead of simple table IDs.
- Table numbers must be unique inside the restaurant.
- Chair capacity must be between 1 and 50.
- QR regeneration is blocked if the table has an active order.
- Table deletion is blocked if the table has an active order.
- Table clearing only clears the current order connected to that table.
- Payment approval clears the table only when the table’s `current_order_id` still matches that exact order.

### Order Protection

- Orders can only be placed from a valid active table QR.
- Public menu only returns active categories and available menu items.
- Backend recalculates item prices from the database instead of trusting frontend totals.
- Backend verifies that requested menu items exist and are available.
- Quantity is limited per item.
- Notes are length-limited.
- If a table already has an active order, a new normal order is blocked.
- Additional items can only be appended through add-more flow.
- Additional items are blocked once payment has started.
- Completed/cancelled orders are treated as closed.

### Payment Protection

- Manager cannot start payment waiting manually.
- Customer must request payment after order is served.
- Manager can approve only an existing waiting payment request.
- Payment method must come from the customer request.
- Completion is blocked unless payment is approved.
- Rejected payments can be retried by the customer.

### Support Request Protection

- Frontend waiter-call cooldown: 60 seconds.
- Cooldown is stored per restaurant/table/type in `localStorage`.
- Backend prevents duplicate open support requests for the same table and request type.
- Invalid QR support requires a table number.
- QR help request supports fallback to the demo restaurant when the slug is invalid.

### Image Upload Protection

- Image upload limit is 5 MB.
- Only image MIME types are accepted.
- Sharp validates the uploaded image content.
- Invalid image files are rejected.
- Uploaded images are resized and converted before storage.
- Replaced/deleted images are cleaned from local storage.

### API and Local Runtime Protection

- Helmet is enabled.
- CORS is restricted to local frontend/backend origins.
- JSON body size is limited to 1 MB.
- Manager/admin APIs are protected by JWT auth.
- Customer APIs are intentionally public because customers access them through QR links.

---

## Database Tables

CampusEats uses these main tables:

### `restaurants`

Stores restaurant information:

- Name
- Slug
- Address
- Phone
- Created date

### `users`

Stores admin and restaurant manager accounts:

- Name
- Email
- Password hash
- Role
- Assigned restaurant
- Created date

Supported roles:

```text
ADMIN
RESTAURANT_MANAGER
```

### `dining_tables`

Stores restaurant tables and QR data:

- Restaurant ID
- Table number
- Table token
- Capacity
- Active/passive state
- Current active order
- Created date

### `categories`

Stores menu categories:

- Restaurant ID
- Category name
- Sort order
- Active/passive state

### `menu_items`

Stores menu products:

- Restaurant ID
- Category ID
- Name
- Description
- Price
- Image URL
- Emoji fallback
- Availability
- Created date

### `orders`

Stores orders:

- Public ID
- Restaurant ID
- Table ID
- Order number
- Order status
- Total price
- Payment status
- Created/updated/completed timestamps

### `order_items`

Stores order lines:

- Order ID
- Menu item ID
- Name snapshot
- Quantity
- Unit price
- Special note

### `payments`

Stores payment approval requests:

- Order ID
- Payment method
- Amount
- Payment status
- Template data
- Approved by
- Approved time
- Rejection reason
- Created date

### `service_requests`

Stores waiter and QR help requests:

- Restaurant ID
- Table ID
- Table number
- Request type
- Message
- Status
- Created/resolved time

---

## API Overview

### Auth API

```text
POST /api/auth/login
GET  /api/auth/me
```

### Admin API

```text
GET    /api/admin/restaurants
POST   /api/admin/restaurants
PATCH  /api/admin/restaurants/:id
DELETE /api/admin/restaurants/:id

GET    /api/admin/managers
POST   /api/admin/managers
PATCH  /api/admin/managers/:id
DELETE /api/admin/managers/:id
```

### Manager API

```text
GET    /api/manager/dashboard

GET    /api/manager/tables
POST   /api/manager/tables
PATCH  /api/manager/tables/:id
POST   /api/manager/tables/:id/clear
POST   /api/manager/tables/:id/regenerate-qr
DELETE /api/manager/tables/:id
GET    /api/manager/tables/:id/qr

GET    /api/manager/menu
POST   /api/manager/categories
PATCH  /api/manager/categories/:id
DELETE /api/manager/categories/:id
POST   /api/manager/menu-items
PATCH  /api/manager/menu-items/:id
DELETE /api/manager/menu-items/:id

GET    /api/manager/orders
GET    /api/manager/orders/:id
PATCH  /api/manager/orders/:id/status
POST   /api/manager/orders/:id/payment/approve
POST   /api/manager/orders/:id/payment/reject

GET    /api/manager/service-requests
PATCH  /api/manager/service-requests/:id
```

### Public Customer API

```text
GET  /api/public/restaurants/:slug/tables/:token/bootstrap
GET  /api/public/restaurants/:slug/menu
POST /api/public/orders
GET  /api/public/orders/:publicId
POST /api/public/orders/:publicId/payment-request
POST /api/public/restaurants/:slug/service-requests
POST /api/public/qr-help
```

### Health Check

```text
GET /api/health
```

Returns local mode information and confirms Firebase is disabled.

---

## Real-Time Events

CampusEats uses Socket.IO for real-time updates.

### Rooms

```text
restaurant:<restaurantId>
order:<publicId>
```

### Client Join Events

```text
joinRestaurant
joinOrder
```

### Server Update Events

```text
orders:changed
tables:changed
menu:changed
support:changed
order:updated
```

### Real-Time Usage

- Manager panel refreshes when new orders arrive.
- Manager panel refreshes when order status changes.
- Manager panel refreshes when tables change.
- Manager panel refreshes when menu changes.
- Manager panel refreshes when support requests change.
- Customer order status updates live through the order room.

---

## Frontend Routes

Main routes include:

```text
/
/login
/admin
/manager
/r/:slug/table/:token
/order/:publicId
/invalid-qr
```

Customer QR route format:

```text
/r/campus-eats/table/<table-token>
```

Add-more mode format:

```text
/r/campus-eats/table/<table-token>?mode=add
```

---

## LocalStorage Usage

CampusEats uses `localStorage` for local demo persistence.

### Stored Data

- Auth token
- Auth user info
- Selected language
- Selected theme
- Customer cart per QR/table
- Support request cooldown timestamps

### Important Keys

New CampusEats keys use the `campuseats_` prefix.

The app also cleans older `qr_dine_` language/theme/auth keys where needed because the project was renamed from QR Dine to CampusEats.

---

## Environment Variables

The backend can run without custom environment variables, but these are supported:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
PUBLIC_APP_URL=http://localhost:5173
JWT_SECRET=local-development-secret
```

Example file:

```text
server/.env.example
```

### Variable Meanings

- `PORT`: Backend port.
- `CLIENT_ORIGIN`: Allowed frontend origin for CORS.
- `PUBLIC_APP_URL`: Base URL used when generating QR links.
- `JWT_SECRET`: JWT signing secret.

---

## Project Structure

```text
CampusEats/
├── package.json
├── README.md
├── .gitignore
├── client/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   │   ├── manifest.json
│   │   └── sw.js
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       ├── i18n.jsx
│       ├── main.jsx
│       ├── styles.css
│       └── components/
│           ├── AdminPanel.jsx
│           ├── AppShell.jsx
│           ├── CustomerApp.jsx
│           ├── Login.jsx
│           ├── ManagerPanel.jsx
│           └── OrderStatus.jsx
└── server/
    ├── package.json
    ├── .env.example
    └── src/
        ├── auth.js
        ├── database.js
        ├── resetDb.js
        ├── server.js
        ├── validation.js
        ├── validators.js
        └── routes/
            ├── adminRoutes.js
            ├── authRoutes.js
            ├── managerRoutes.js
            └── publicRoutes.js
```

Generated local runtime folders:

```text
server/data/
server/public/uploads/menu/
client/dist/
```

---

## Development Notes

### Resetting Demo Data

To reset the local database:

```bash
npm --prefix server run reset-db
```

Then start the app again:

```bash
npm run dev
```

### Product Images in Development

The Vite development server proxies `/uploads` to the backend, so uploaded menu images are visible in development mode.

### Production-Like Local Run

Build the frontend:

```bash
npm run build
```

Start the backend:

```bash
npm start
```

Then open:

```text
http://localhost:4000
```

The Express backend serves the React build files.

---

## Design Direction

CampusEats uses a clean, modern, mobile-first design direction:

- Rounded cards
- Soft blue/teal gradients
- Mobile phone-like customer layout
- Fixed cart button on customer menu
- Clear order confirmation screen
- Dashboard cards for manager statistics
- Segmented theme/language controls
- Dark mode support
- Responsive admin and manager panels

The customer UI is designed mainly for smartphone QR usage, while admin and manager panels are designed for desktop/tablet usage but remain responsive.

---

## Graduation Project Note

CampusEats is prepared as a graduation project/demo system. It focuses on demonstrating a complete restaurant QR ordering workflow locally:

- Admin management
- Restaurant manager operations
- Fixed table QR system
- Customer digital menu
- Live order tracking
- Payment approval template
- Waiter/support requests
- Local database and uploads
- PWA-ready web app experience

It is not connected to a real payment provider and does not depend on cloud services.
