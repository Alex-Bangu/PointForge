# PointForge

A comprehensive points management system for organizations, allowing users to earn, transfer, redeem, and manage points through purchases, events, promotions, and transactions.

## Live Demo

**Production URL**: https://frontend-service-production-e80c.up.railway.app/login

## Demo Credentials

All demo accounts use the password: `Password123!`

### Superuser
- **UTORid**: `supersu1`
- **Name**: Super Admin
- **Role**: Superuser (full access)

### Managers
- **UTORid**: `manager1`
- **Name**: Mandy Manager
- **Role**: Manager

- **UTORid**: `manager2`
- **Name**: Mike Manager
- **Role**: Manager

- **UTORid**: `manager3`
- **Name**: Megan Manager
- **Role**: Manager

### Cashiers
- **UTORid**: `cashier1`
- **Name**: Clara Cashier
- **Role**: Cashier
- **Note**: This account is marked as suspicious for testing purposes

- **UTORid**: `cashier2`
- **Name**: Chris Cashier
- **Role**: Cashier

- **UTORid**: `cashier3`
- **Name**: Carl Cashier
- **Role**: Cashier

### Regular Users
- **UTORid**: `reguser1`
- **Name**: Alice Regular
- **Points**: 3,000
- **Role**: Regular User

- **UTORid**: `reguser2`
- **Name**: Bob Regular
- **Points**: 50
- **Role**: Regular User

- **UTORid**: `reguser3`
- **Name**: Charlie NoTx
- **Points**: 100
- **Role**: Regular User

- **UTORid**: `reguser4`
- **Name**: Diana Verified
- **Points**: 1,250
- **Role**: Regular User

- **UTORid**: `reguser5`
- **Name**: Evan Unverified
- **Points**: 400
- **Role**: Regular User (Unverified)

Additional regular users: `reguser6` through `reguser13` (see seed data for details)

## Architecture

### Technology Stack

**Backend:**
- **Node.js** + **Express**: RESTful API server
- **Prisma** + **SQLite**: ORM and database
- **JWT**: Authentication and authorization
- **bcrypt**: Password hashing
- **Mailgun**: Email service (optional)

**Frontend:**
- **React 19**: UI framework
- **React Router**: Client-side routing
- **Vite**: Build tool and dev server
- **qrcode.react**: QR code generation
- **Google Maps Embed API**: Event location maps

### System Architecture

```
┌─────────────┐
│   Browser   │
│  (React)    │
└──────┬──────┘
       │ HTTP/REST
       │
┌──────▼──────┐
│   Express   │
│   Backend   │
└──────┬──────┘
       │
┌──────▼──────┐
│   Prisma    │
│    ORM      │
└──────┬──────┘
       │
┌──────▼──────┐
│   SQLite    │
│  Database   │
└─────────────┘
```

### Key Features

- **User Management**: Role-based access control (Regular, Cashier, Manager, Superuser)
- **Transaction Types**: Purchase, Redemption, Transfer, Event, Adjustment
- **Promotions**: Automatic and one-time promotions with spending requirements
- **Events**: Event creation, RSVP, and point rewards
- **QR Codes**: For transaction redemption
- **Multi-language Support**: English, Spanish, French, Chinese, German, Italian, Portuguese, Russian, Japanese, Korean
- **Accessibility**: Colorblind mode support
- **Interface Switching**: Users can switch between different role interfaces

## Installation

See [INSTALL](INSTALL) for detailed installation and deployment instructions.

### Quick Start

1. **Backend:**
```bash
cd backend
npm install
npm run prestart  # Initializes database and seeds data
npm start
```

2. **Frontend:**
```bash
cd frontend/PointForge
npm install
npm run dev
```

## Configuration

### Required Environment Variables

**Backend** (`backend/.env`):

**Required:**
- `DATABASE_URL`: SQLite database path (e.g., `file:./database.db` for local, `file:/data/database.db` for Railway)
- `JWT_SECRET`: Secret key for JWT tokens (generate a secure random string)
- `CORS_ORIGIN`: **Where your frontend is running** - allows that origin to make API requests
  - **Local development**: `http://localhost:5173` (Vite dev server port)
  - **Production**: Your production frontend URL (e.g., `https://frontend-service-production-e80c.up.railway.app`)
  - **Multiple origins**: Separate with commas: `http://localhost:5173,https://your-production-url.com`

**Optional:**
- `PORT`: Server port (default: 3000, Railway sets this automatically)
- `FRONTEND_URL`: **Production frontend URL** - used for password reset email links
  - Should be your production URL even when testing locally (so reset links work)
  - Example: `https://frontend-service-production-e80c.up.railway.app`
- `MAILGUN_API_KEY`: Mailgun API key for email functionality (optional)
- `MAILGUN_DOMAIN`: Mailgun domain for email functionality (optional)
- `SEED_DATABASE`: Set to `true` to auto-seed database on startup (optional, Railway only)

**Frontend** (`frontend/PointForge/.env`):
- `VITE_API_URL`: Backend API URL
  - **Local development**: `http://localhost:3000`
  - **Production**: Your production backend URL (e.g., `https://your-backend.railway.app`)
- `VITE_GOOGLE_MAPS_API_KEY`: Google Maps API key (optional, for event location maps)

### Understanding CORS_ORIGIN vs FRONTEND_URL

- **`CORS_ORIGIN`**: Controls which browser origins can make API requests to your backend. This is a security feature. Set it to wherever your frontend is actually running (localhost for local dev, production URL for production).
- **`FRONTEND_URL`**: Used to generate links in password reset emails. Should be your production URL so users clicking the link go to the right place.

**Example Setup:**

**Local Development (.env):**
```env
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=https://frontend-service-production-e80c.up.railway.app
DATABASE_URL=file:./database.db
JWT_SECRET=your-local-secret-key
```

**Production (Railway Environment Variables):**
```env
CORS_ORIGIN=https://frontend-service-production-e80c.up.railway.app
FRONTEND_URL=https://frontend-service-production-e80c.up.railway.app
DATABASE_URL=file:/data/database.db
JWT_SECRET=your-production-secret-key
MAILGUN_API_KEY=your-mailgun-key
MAILGUN_DOMAIN=your-mailgun-domain
```

See [INSTALL](INSTALL) for complete configuration details.

## Database Schema

The database includes:
- **Users**: 20 users (1 superuser, 3 managers, 3 cashiers, 13 regular users)
- **Transactions**: 30+ transactions (purchases, redemptions, transfers, events, adjustments)
- **Events**: 6 events (past, present, future, published/unpublished)
- **Promotions**: 15 promotions (automatic and one-time)

All data is prepopulated via the seed script (`backend/prisma/seed.mjs`).

## Third-Party Services

- **Google Maps Embed API**: For displaying event locations (optional)
- **Mailgun**: For password reset emails (optional)

## API Endpoints

### Authentication
- `POST /auth/tokens` - Login
- `POST /auth/resets` - Request password reset
- `GET /auth/resets/:resetId` - Verify reset token

### Users
- `GET /users` - List users (managers/cashiers only)
- `GET /users/me` - Get current user
- `PATCH /users/me` - Update current user
- `PATCH /users/me/password` - Change password
- `POST /users/create-account` - Create new account (cashiers/managers)
- `GET /users/search/:utorid` - Search user (cashiers/managers)
- `GET /users/search-transfer/:utorid` - Search user for transfer (regular users)

### Transactions
- `GET /transactions` - List transactions (managers only)
- `POST /transactions` - Create transaction (purchase/adjustment/transfer)
- `POST /users/me/transactions` - Create redemption request

### Promotions
- `GET /promotions` - List promotions
- `GET /promotions/:id` - Get promotion details
- `POST /promotions/:id/use` - Add promotion to wallet

### Events
- `GET /events` - List events
- `GET /events/:id` - Get event details
- `POST /events/:id/rsvp` - RSVP to event

## Testing

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for comprehensive testing instructions.

## License

ISC (Internet Systems Consortium License)

This is a permissive open-source license that allows free use, modification, and distribution of the code. It's similar to the MIT license but simpler. The license is specified in `backend/package.json`.

## 👥 Authors

Alexander Bangu, Daniel Rafailov

## Acknowledgments

- **qrcode.react**: QR code generation library (https://www.npmjs.com/package/qrcode.react)
- **Google Maps Embed API**: Event location mapping (https://developers.google.com/maps/documentation/embed)
- React and Express communities for excellent documentation

