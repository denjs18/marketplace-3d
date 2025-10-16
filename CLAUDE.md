# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marketplace 3D is a full-stack web application connecting 3D printing clients with professional 3D printers. Clients upload STL files with specifications, receive quotes from multiple printers, and manage projects. Printers browse available projects, submit quotes, and receive automated payouts through Stripe (after 10% platform commission).

## Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (access + refresh tokens)
- **Real-time**: Socket.IO for messaging
- **Payments**: Stripe Connect for marketplace payments
- **File Upload**: Multer for STL and image files
- **Email**: Nodemailer
- **Frontend**: Vanilla JavaScript, HTML5, CSS3

## Architecture

### Backend Structure

**Models** (`/models`): Mongoose schemas with business logic methods
- `User.js`: Dual role model (client/printer) with role-specific fields
- `Project.js`: Print jobs with STL files and specifications
- `Quote.js`: Printer proposals with pricing and delivery estimates
- `Message.js`: Real-time messaging between users
- `Transaction.js`: Payment records with commission calculations

**Controllers** (`/controllers`): Business logic separated from routes
- Each controller handles CRUD operations for its domain
- Controllers populate relationships and enforce authorization

**Middleware** (`/middleware`):
- `auth.js`: JWT verification, role-based authorization (`isClient`, `isPrinter`)
- `upload.js`: Multer configurations for STL (100MB), images (5MB)
- `validation.js`: Request validation with error messages

**Config** (`/config`):
- `auth.js`: JWT token generation/verification utilities
- `stripe.js`: Payment intent creation, transfers, commission calculations
- `database.js`: MongoDB connection with event handlers

**Utils** (`/utils`):
- `email.js`: Transactional email templates (welcome, quote notifications, etc.)
- `calculateCommission.js`: 10% commission calculation utilities

### Key Workflows

**Client Project Creation**:
1. Client uploads STL via `/api/projects` (authenticated, isClient)
2. File saved to `/uploads/stl/` with unique filename
3. Project status: `open` → printers can browse
4. Automatic email notifications disabled initially to avoid errors

**Quote Submission**:
1. Printer views open projects in `/api/projects` (filtered by role)
2. Submits quote via `/api/quotes` with price, delivery date, message
3. Project status: `open` → `quoted`
4. Client receives email notification with quote details
5. One quote per printer per project (enforced in controller)

**Quote Acceptance & Payment**:
1. Client accepts quote via `/api/quotes/:id/accept`
2. All other quotes automatically rejected
3. Project assigned to printer, status: `in_progress`
4. Stripe payment intent created via `/api/payments/create-intent`
5. Transaction record created with commission breakdown
6. On payment success, project starts

**Project Completion & Payout**:
1. Printer marks project complete via `/api/projects/:id/complete`
2. Payout triggered via `/api/payments/payout`
3. Stripe transfer created to printer's connected account (90% of total)
4. Platform retains 10% commission
5. Printer earnings updated in User model

**Real-time Messaging**:
- Socket.IO connections established on client connect
- Users join room by userId
- Messages saved to DB and emitted to recipient socket
- Unread counts tracked, email notifications sent

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (nodemon)
npm run dev

# Start production server
npm start

# MongoDB must be running separately
# Windows: net start MongoDB
# macOS: brew services start mongodb-community
# Linux: sudo systemctl start mongod
```

## Environment Setup

Copy `.env.example` to `.env` and configure:

**Critical Variables**:
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Strong random string for token signing
- `STRIPE_SECRET_KEY`: Stripe API key (test mode for development)
- `SMTP_USER` / `SMTP_PASS`: Email service credentials

**File Upload Paths**:
- STL files: `uploads/stl/`
- Images: `uploads/images/`
- Attachments: `uploads/attachments/`

Create upload directories: `mkdir -p uploads/{stl,images,attachments}`

## Authentication Flow

1. Registration/Login returns `token` (7d expiry) and `refreshToken` (30d expiry)
2. Client stores tokens (typically in localStorage)
3. All authenticated requests include `Authorization: Bearer <token>` header
4. Middleware `authenticate` verifies token, attaches `req.user`, `req.userId`, `req.userRole`
5. Role middleware (`isClient`, `isPrinter`) enforces access control
6. Refresh token endpoint `/api/auth/refresh` issues new tokens

## Database Relationships

- **User** ← (client) **Project** → (assignedPrinter) **User**
- **Project** ← **Quote** → (printer) **User**
- **Project** ← **Message** (optional reference)
- **Quote** ← **Transaction** → **User** (client & printer)

All models use MongoDB ObjectIds for references. Use `.populate()` in queries to retrieve related data.

## Payment Commission System

**Fixed 10% platform commission** on all transactions:

```javascript
// In utils/calculateCommission.js
const COMMISSION_RATE = 0.10;
const commission = amount * COMMISSION_RATE;        // Platform keeps
const printerPayout = amount * (1 - COMMISSION_RATE); // Printer receives
```

Transaction model automatically calculates commission on save. Stripe transfers use `printerPayout` amount.

## API Authorization Patterns

**Public routes**: `/api/auth/register`, `/api/auth/login`

**Client-only routes**: Create projects, accept quotes, make payments

**Printer-only routes**: Submit quotes, view earnings

**Shared routes**: View projects (filtered by role), messaging, profile updates

**Ownership checks**: Controllers verify user owns resource before modification (e.g., client owns project before updating)

## Frontend Integration

Frontend uses vanilla JavaScript with fetch API. Key patterns:

1. Store JWT token in localStorage after login
2. Include token in all API requests: `Authorization: Bearer ${token}`
3. Socket.IO client connects with token for authentication
4. Three.js used for STL file visualization (not yet implemented in this codebase)

## Common Development Tasks

**Add new API endpoint**:
1. Create controller method in `/controllers/`
2. Add route in `/routes/`
3. Apply appropriate middleware (auth, validation)
4. Update this file if it changes architecture

**Modify commission rate**:
1. Update `COMMISSION_RATE` in `/utils/calculateCommission.js`
2. Update `.env.example` with new default
3. Existing transactions unchanged (stored value)

**Add email notification**:
1. Create template function in `/utils/email.js`
2. Call from controller (use `.catch()` to avoid blocking on error)
3. Test with real SMTP credentials

**Debug authentication issues**:
- Check `JWT_SECRET` is set in `.env`
- Verify token format: `Bearer <token>`
- Check token expiry with jwt.io
- Ensure `authenticate` middleware is applied to route

## Testing the Application

**Manual Testing Flow**:
1. Register client account at `/register.html`
2. Register printer account (separate email)
3. As client: create project with STL file
4. As printer: view project, submit quote
5. As client: accept quote
6. Test messaging between users
7. As printer: mark project complete
8. Check transaction records in `/api/payments/transactions`

**Stripe Testing**:
- Use test card: `4242 4242 4242 4242`
- Any future expiry, any CVC
- Test mode keys required in `.env`

## Known Limitations

- Three.js STL viewer not yet implemented in frontend JavaScript
- Email sending will fail without valid SMTP credentials (non-blocking)
- Stripe webhooks not fully implemented (manual confirmation required)
- No image optimization for uploaded files
- No rate limiting on API endpoints
- Frontend uses vanilla JS (no build step or framework)

## File Paths and Routes

**Backend**: All routes under `/api/*`
**Frontend static files**: Served from `/public/` directory
**Uploaded files**: Accessible at `/uploads/{stl,images,attachments}/*`

When modifying routes, ensure `server.js` wildcard catch-all (`app.get('*')`) remains last to serve frontend.

## MongoDB Indexes

Models include indexes for common queries:
- User: `email` (unique)
- Project: `status`, `client`, text search on title/description
- Quote: `project + printer` (unique), `status`
- Message: `sender + recipient`, `recipient + isRead`
- Transaction: `client`, `printer`, `stripePaymentIntentId`

## Socket.IO Events

**Client → Server**:
- `join-room`: User joins their personal room (userId)
- `send-message`: Send message to recipient

**Server → Client**:
- `receive-message`: New message received (to specific room)

Messages are also saved to DB for persistence.

## Error Handling Patterns

Controllers use try-catch blocks, returning JSON error responses:

```javascript
res.status(statusCode).json({
  error: 'User-friendly error message',
  details: error.message  // Technical details (remove in production)
});
```

Middleware errors caught by Express error handler in `server.js`.

## Security Considerations

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens signed and verified
- File upload validation (type, size)
- CORS enabled (configure `FRONTEND_URL` for production)
- Helmet.js sets security HTTP headers
- Input validation on all endpoints
- Role-based authorization on sensitive routes

## Deployment Checklist

- [ ] Set strong `JWT_SECRET` in production
- [ ] Use production MongoDB (MongoDB Atlas recommended)
- [ ] Switch Stripe to live mode keys
- [ ] Configure production SMTP service
- [ ] Enable HTTPS
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper CORS origins
- [ ] Set up MongoDB backups
- [ ] Configure Stripe webhooks with production URL
- [ ] Remove `error.details` from API responses

## Code Style Conventions

- Use async/await (not callbacks)
- Models in PascalCase, files in camelCase
- Route handlers use controller functions (not inline)
- Validation middleware before controller
- Authentication middleware on all private routes
- Populate relationships in controllers, not routes
- Return early on errors (avoid deep nesting)

## Troubleshooting

**"MongooseError: Operation buffering timed out"**
→ MongoDB not running or wrong URI in `.env`

**"JsonWebTokenError: invalid token"**
→ Check token format, ensure JWT_SECRET matches

**"MulterError: File too large"**
→ Check limits in `/middleware/upload.js`

**"Error: Invalid login" (email)**
→ Use Gmail app password, not account password

**Socket.IO not connecting**
→ Check CORS settings, verify frontend Socket.IO client version matches server

## Future Enhancements

- Implement Three.js STL viewer in frontend
- Add project rating system after completion
- Implement Stripe webhook handlers for automated flows
- Add admin dashboard for platform management
- Implement search and filter for projects/printers
- Add file format validation (parse STL headers)
- Implement push notifications
- Add printer availability calendar
- Create mobile-responsive React/Vue frontend
- Add comprehensive test suite (Jest, Supertest)
