# CampusEats

A smart QR-based restaurant ordering system that runs entirely on your machine. Customers scan a fixed table QR code, browse the menu and order from their phone; restaurant managers handle orders, payments, tables and the menu live from one panel.

**Stack:** React 19 + Vite · Node.js / Express · SQLite (`better-sqlite3`) · Socket.IO · PWA

![Landing page](docs/screenshots/landing.png)

## Screenshots

| Customer menu | Order status |
|---|---|
| <img src="docs/screenshots/customer-menu.png" width="300" alt="Customer menu on a phone"> | <img src="docs/screenshots/customer-order-status.png" width="300" alt="Customer order status"> |

**Manager panel: live orders grouped by table (dark theme)**

![Manager orders](docs/screenshots/manager-orders.png)

**Manager panel: tables and fixed QR codes**

![Manager tables and QR codes](docs/screenshots/manager-tables-qr.png)

**Admin panel: restaurants and manager accounts**

![Admin panel](docs/screenshots/admin-panel.png)

## Features

**Customer (mobile web / PWA)**
- Opens the menu from a fixed table QR link (`/r/<restaurant-slug>/table/<token>`)
- Search, category filter, cart with per-item notes, 10% tax included in the total
- Live order tracking; the status screen title changes with each stage
- Several separate orders per table (“Add more items” opens a new order card)
- Cancel an order while it is still **Pending**
- Call a waiter, or ask for help from the invalid QR page
- Pay by card or IBAN transfer (approved automatically) or cash (approved by the manager)

**Restaurant manager**
- Dashboard: today’s numbers, 7- and 30-day revenue, order counts, average ticket, best sellers, recently cancelled orders
- Today’s orders grouped by table, with bulk actions per table (preparing → ready → served → approve payment)
- Order history grouped by day; clearing closed orders asks for confirmation twice
- Table CRUD, QR preview/download, regenerate a QR, clear a table session
- Menu and category CRUD; category names and sort numbers must be unique per restaurant
- Menu image upload, resized to fit 900×900 and saved as WebP (quality 88)
- Live updates for orders and support requests via WebSocket

**System admin**
- Create, edit and delete restaurants (deleting a restaurant also deletes its managers)
- Create and edit manager accounts (email, password, assigned restaurant)
- Field-level validation errors on both frontend and backend, in the UI language

**General**
- Turkish / English UI and light / dark theme, saved in `localStorage`
- Installable PWA with app icons
- Payment approval clears the table session; the same QR code then works for the next customer

## Getting started

Requires Node.js 20+.

```bash
npm run install:all
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

To run it like production (Express serves the React build on a single port, http://localhost:4000):

```bash
npm run build
npm start
```

Optional: copy `server/.env.example` to `server/.env` to set the port, origins and JWT secret. To reset the database back to the demo data, run `npm --prefix server run reset-db`.

## Demo accounts

> ⚠️ **Local demo only.** These accounts are seeded into the local SQLite database for testing. Change the passwords (and set `JWT_SECRET`) before exposing the app anywhere, including a temporary tunnel.

| Role | Email | Password |
|---|---|---|
| System Admin | `admin@local.test` | `admin123!` *(local demo only)* |
| Restaurant Manager | `manager@local.test` | `manager123!` *(local demo only)* |

Password policy: at least 6 characters, including at least one number and one special character.

## Demo walkthrough

1. Sign in as `manager@local.test` and open **Tables & QR**.
2. Copy a table link or download its QR code (or click **Open customer demo** on the landing page).
3. As the customer, add items to the cart and confirm the order. It appears live under **Orders**.
4. Place more orders from the same table; each one gets its own card.
5. Move the table’s orders through **Preparing → Ready → Served**.
6. Once every active order is served, the customer requests payment. Card or IBAN payments are approved automatically; for cash, the manager clicks **Approve Payment**.
7. The table session is cleared and the same QR code is ready for the next customer.

## Project structure

```text
client/   React + Vite frontend (customer UI, manager and admin panels, PWA)
server/   Express API, Socket.IO, SQLite database, image uploads
docs/     README screenshots
```

## Notes

- The SQLite database is created at `server/data/campuseats.sqlite` (git-ignored).
- Uploaded menu images are stored in `server/public/uploads/menu/` (git-ignored).
- QR codes are fixed per table. Approving a payment resets the table’s active session, not its QR code.

## License

[MIT](LICENSE)
