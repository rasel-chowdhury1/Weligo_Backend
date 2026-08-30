# Weligo Backend

Backend API server for **Weligo** — a booking/marketplace platform connecting **families** with **care providers**, with in-app chat, real-time audio/video calling, availability scheduling, reviews, payments, and support ticketing.

Built with **Node.js, Express, TypeScript, MongoDB (Mongoose), and Socket.IO**.

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture & Project Structure](#architecture--project-structure)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Development / Production Commands](#development--production-commands)
- [Database Setup](#database-setup)
- [API Documentation](#api-documentation)
- [Authentication & Authorization](#authentication--authorization)
- [Payment / Third-Party Integrations](#payment--third-party-integrations)
- [File Uploads](#file-uploads)
- [Notifications / Realtime Features](#notifications--realtime-features)
- [Cron Jobs](#cron-jobs)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Security Notes](#security-notes)

## Project Overview

Weligo Backend exposes a REST API (mounted under `/api/v1`) plus a Socket.IO realtime layer for a two-sided marketplace app:

- **Family** users book **Provider** users for care services, organized by **Category** and **Availability** schedules.
- Bookings flow through a full lifecycle (accept/decline/start/complete/cancel/dispute) with payment capture via Stripe.
- Users chat and place audio/video calls to each other over WebRTC, signaled through Socket.IO.
- Admins moderate providers, categories, support tickets, reports, and view platform overview/earnings dashboards.

## Features

- User registration/login for **family**, **provider**, and **admin** roles, with OTP-based email/phone verification
- Provider profile completion (certificates, bio, preferences) and admin approval workflow
- Category management for services
- Provider weekly availability scheduling with per-day time slots and booking rules
- Booking lifecycle: create → accept/decline → start → complete → confirm → cancel, with status history and reschedule support
- Payments via Stripe Checkout (capture, cancel, refund) with webhook handling; a legacy/unused Datatrans gateway is also present in code
- In-app chat (1:1 messaging with images, read receipts, message approval workflow)
- Real-time audio/video calling over WebRTC, signaled via Socket.IO (offer/answer/ICE relay, ring timeout, missed/rejected/cancelled/ended states)
- Real-time notifications (unread counts, mark-as-read) pushed over Socket.IO
- Reviews and ratings between users, with replies
- Reports (user-to-user) and Support tickets (with threaded messages and attachments)
- Feedback collection with admin verification
- Favorites (users can favorite other users)
- Admin platform overview/earnings endpoints
- Static settings pages (privacy policy, terms & conditions, about us)
- A built-in HTML server monitoring dashboard (`GET /`) showing recent errors, response times, and live CPU usage

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (TypeScript) |
| Web framework | Express 4 |
| Database | MongoDB via Mongoose 8 |
| Realtime | Socket.IO 4 (separate HTTP server) |
| Auth | JSON Web Tokens (`jsonwebtoken`), `bcrypt` password hashing |
| Validation | Zod |
| File uploads | Multer (local disk storage) |
| Payments | Stripe SDK (active), Datatrans REST API (legacy/unused) |
| SMS | Twilio (phone OTP delivery only) |
| Email | Nodemailer (Gmail SMTP) |
| Logging | Winston + `winston-daily-rotate-file` |
| Dates/timezones | Moment / Moment-Timezone |
| Dev tooling | ts-node-dev, ESLint, Prettier |

## Architecture & Project Structure

```
Weligo_Backend/
├── src/
│   ├── server.ts                # Entry point: DB connection, HTTP server, Socket.IO bootstrap
│   ├── app.ts                   # Express app: middleware, route mounting, error handlers
│   ├── socketIo.ts               # Socket.IO server: chat, notifications, WebRTC call signaling
│   └── app/
│       ├── config/               # Environment variable loading (src/app/config/index.ts)
│       ├── error/                 # AppError, CastError, DuplicateError, MulterError, ValidationError, ZodError
│       ├── helpers/                # serverHomePage.ts (GET / monitoring dashboard)
│       ├── interface/              # Shared TypeScript types/ambient declarations
│       ├── middleware/              # auth.ts, validateRequest.ts, fileUpload.ts, globalErrorhandler.ts, notfound.ts
│       ├── routes/                  # Central route aggregator (src/app/routes/index.ts)
│       ├── utils/                   # logger.ts, tokenManage.ts, mailSender.ts, sendResponse.ts, catchAsync.ts, etc.
│       └── modules/
│           ├── auth/                 # Login, refresh token, password reset
│           ├── user/                  # User accounts, profiles, provider approval, favorites
│           ├── providerProfile/        # Provider certificates/bio (used internally by user module)
│           ├── otp/                     # OTP generation/verification
│           ├── category/                 # Service categories
│           ├── availability/              # Provider weekly schedules & booking rules
│           ├── booking/                    # Booking lifecycle & payment linkage
│           ├── payment/                     # Stripe/Datatrans gateways, webhooks
│           │   └── gateways/                 # stripe/, datatrans/
│           ├── chat/                          # Chat threads
│           ├── message/                        # Chat messages
│           ├── call/                            # Call history records
│           ├── notifications/                    # In-app notifications
│           ├── reveiw/                            # Reviews & ratings (module folder name as-is in source)
│           ├── report/                             # User-to-user reports
│           ├── support/                             # Support tickets
│           ├── feedback/                             # App feedback
│           ├── setting/                               # Privacy/terms/about content
│           ├── overview/                               # Admin & personal dashboards
│           ├── placeholder/                             # Temporary payment-return landing page
│           └── DB/                                       # Default admin seeding
├── docs/
│   └── call-socket-events.md    # Full Socket.IO call-signaling event reference
├── public/                       # Static files, served at `/` (includes public/uploads/*)
├── logs/                          # Winston daily-rotated log files
├── tsconfig.json                   # rootDir: src, outDir: dist
└── package.json
```

**Request flow:** `server.ts` connects to MongoDB → seeds a default admin → starts the Express HTTP server (`app.ts`) → starts the Socket.IO server on a separate port (`socketIo.ts`). REST requests hit `app.ts` → `/api/v1` router → module route → controller → service → Mongoose model. Errors thrown anywhere flow into `globalErrorHandler`.

## Installation & Setup

**Prerequisites:** Node.js, npm, and a running MongoDB instance.

```bash
# 1. Clone the repository
git clone <repository-url>
cd Weligo_Backend

# 2. Install dependencies
npm install

# 3. Create a .env file at the project root (see Environment Variables below)

# 4. Run in development mode
npm run dev
```

The API listens on `PORT` (Express) and Socket.IO listens on `SOCKET_PORT` (default `9020`) — see [Environment Variables](#environment-variables).

## Environment Variables

Defined and read in `src/app/config/index.ts` (loaded via `dotenv` from a root `.env` file). **No `.env.example` exists in this repository** — an `.env` file must be created manually. Values are never included below — only variable names and purpose.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Environment mode (`development`/`production`); controls whether error stack traces are returned |
| `PORT` | Express HTTP server port |
| `IP` | Bind/display IP used in the startup log message |
| `DATABASE_URL` | MongoDB connection string |
| `SERVER_URL` | Public server URL |
| `CLIENT_URL` | Frontend app URL |
| `BCRYPT_SALT_ROUNDS` | bcrypt hashing cost factor |
| `JWT_ACCESS_SECRET` | Access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL |
| `NODEMAILER_HOST_EMAIL` | Gmail SMTP auth user for outgoing email |
| `NODEMAILER_HOST_PASS` | Gmail SMTP auth password/app password |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_PHONE` | Credentials used to seed the default admin account on startup |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | Twilio credentials for SMS OTP delivery |
| `OTP_EXPIRE_TIME` | OTP code expiry duration |
| `OTP_TOKEN_EXPIRE_TIME` | OTP verification JWT expiry duration |
| `SOCKET_PORT` | Port the Socket.IO HTTP server listens on |
| `STRIPE_API_KEY` / `STRIPE_API_SECRET` | Stripe keys mapped in `config/index.ts` (see note below) |
| `S3_BUCKET_ACCESS_KEY` / `S3_BUCKET_SECRET_ACCESS_KEY` / `AWS_REGION` / `AWS_BUCKET_NAME` | AWS/S3 config present in `config/index.ts`; **not currently used anywhere in the codebase** (uploads are stored on local disk) |

Read directly via `process.env` outside `config/index.ts` (used by the payment gateways and monitoring page):

| Variable | Used in | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | `src/app/modules/payment/gateways/stripe/stripe.utils.ts` | Active Stripe client secret key |
| `STRIPE_WEBHOOK_SECRET` | `stripe.utils.ts` | Verifies the `stripe-signature` webhook header |
| `APP_BASE_URL` | Stripe & Datatrans gateway code | Base URL used to build payment redirect/return URLs |
| `DATATRANS_BASE_URL` / `DATATRANS_MERCHANT_ID` / `DATATRANS_PASSWORD` / `DATATRANS_WEBHOOK_HMAC_KEY` | `datatrans.gateway.ts` | Datatrans gateway credentials (see [Payment / Third-Party Integrations](#payment--third-party-integrations) — this gateway is not currently invoked) |
| `PROJECT_NAME` | `src/app/helpers/serverHomePage.ts` | Title shown on the `GET /` monitoring dashboard |
| `MONITOR_USERNAME` / `MONITOR_PASSWORD` | `serverHomePage.ts` | Client-side gate credentials for the monitoring dashboard (see [Security Notes](#security-notes)) |

> **Note:** Stripe keys are configured under two different variable-name conventions (`STRIPE_API_KEY`/`STRIPE_API_SECRET` mapped in `config/index.ts`, vs. `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` read directly by the active gateway code). Ensure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set, since those are what the live payment code actually consumes.

## Development / Production Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the server in watch mode (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/` (per `tsconfig.json`) |
| `npm run start:prod` | Run the compiled server from `dist/server.js` |
| `npm run lint` | Run ESLint over the project |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run prettier` | Format files under `src/` with Prettier |
| `npm run prettier:fix` | Format the entire project with Prettier |
| `npm test` | Not implemented — currently a stub that exits with an error (see [Testing](#testing)) |

## Database Setup

- **Database:** MongoDB, connected via Mongoose using `DATABASE_URL` in `src/server.ts`.
- **No migration/seeding scripts** exist beyond an automatic **default admin seed**: on every startup, `src/app/modules/DB/createDefaultAdmin.ts` creates an admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_PHONE` if one doesn't already exist.
- **Collections/models** (see `src/app/modules/*/**.model.ts`):

| Model | Notable fields |
|---|---|
| `User` | name, email, password (hashed), role (`family`/`provider`/`user`/`admin`), profile fields, `location` (GeoJSON, geo-indexed), `approvalStatus`, `favoriteUsers`, `status` |
| `ProviderProfile` | certificates, bio, preferences (non-smoker, driver's license, etc.) |
| `Availability` | per-user weekly schedule with time slots, booking rules |
| `Category` | name, description, icon, image, order, status |
| `Booking` | customer/provider refs, schedule, address/location, payment amounts, full status history |
| `Payment` | booking ref, amounts/commission, gateway references, Stripe session/intent IDs, status |
| `Chat` | participant users, unread counts, blocked users |
| `Message` | text/images, sender/receiver/chat refs, read state, approval status |
| `Call` | caller/receiver, type (audio/video), status, duration |
| `Notification` | recipient, message payload, type, read state |
| `Review` | booking/reviewer/receiver refs, rating, comment, reply |
| `Report` | booking/reporter/reported-user refs, reason, status |
| `Support` (ticket) | user, subject, threaded messages with attachments, status |
| `Feedback` | user, text, rating, admin verification status |
| `Otp` | destination (email/phone), purpose, code, expiry, status |
| `Setting` | key (`privacy_policy`/`term_condition`/`about_us`), content |

## API Documentation

All endpoints are mounted under **`/api/v1`** (see `src/app/routes/index.ts`), except the temporary payment-return page at `/payments/return`. "Auth" indicates the `auth(...)` middleware and which roles are permitted (`ADMIN`, `PROVIDER`, `FAMILY`). Endpoints marked **Auth commented out** have role checks disabled in the current source (open access) — see [Security Notes](#security-notes).

### Auth — `/api/v1/auth`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/login` | None | Log in, returns access + refresh tokens |
| POST | `/refresh-token` | None | Exchange a refresh token for a new access token |
| POST | `/forgot-password-otpByEmail` | None | Send a password-reset OTP by email |
| POST | `/forgot-password-otpByNumber` | None | Send a password-reset OTP by SMS (Twilio) |
| PATCH | `/change-password` | Family, Provider, Admin | Change password while logged in |
| PATCH | `/forgot-password-otp-match` | None | Verify the forgot-password OTP |
| PATCH | `/forgot-password-reset` | None | Set a new password after OTP verification |

### OTP — `/api/v1/otp`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| PATCH | `/resend-otp` | None | Resend an OTP code |

### Users — `/api/v1/users`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/register` | None | Register a new user |
| POST | `/create` | None | Create a user (pre-verification) |
| POST | `/create-user-verify-otp` | None | Verify OTP for account creation |
| POST | `/complete` | Provider, Family, Admin | Complete profile (multipart: `image`) |
| PATCH | `/provider-profile` | Provider | Complete provider profile (multipart: `certificateFiles` ×10, `image`) |
| GET | `/admin-profile` | Admin | Get the admin's own profile |
| GET | `/all-users` | Admin | List all users |
| GET | `/all-users-overview` | Admin | User statistics overview |
| GET | `/all-families` | Auth commented out | List family users |
| GET | `/all-providers` | Auth commented out | List provider users |
| GET | `/pending-providers` | Auth commented out | List providers pending approval |
| PATCH | `/approve-provider/:id` | Auth commented out | Approve a provider |
| PATCH | `/reject-provider/:id` | Auth commented out | Reject a provider |
| GET | `/my-profile` | Provider, Family, Admin | Get the current user's profile |
| GET | `/top-rated-providers` | None | List top-rated providers |
| GET | `/search-providers` | None | Search providers |
| GET | `/favorites` | Provider, Family, Admin | List the current user's favorited users |
| POST | `/favorites/:id` | Provider, Family, Admin | Add a user to favorites |
| DELETE | `/favorites/:id` | Provider, Family, Admin | Remove a user from favorites |
| GET | `/provider/:id` | Auth commented out | Get provider public details |
| GET | `/:id` | Provider, Family, Admin | Get a user by ID |
| PATCH | `/update-my-profile` | Provider, Family, Admin | Update own profile (multipart: `image`) |
| PATCH | `/block/:id` | Admin | Block a user |
| DELETE | `/delete-my-account` | Provider, Family, Admin | Delete own account |

### Categories — `/api/v1/categories`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/create` | Auth commented out | Create a category (multipart: `icon`, `image`) |
| GET | `/` | None | List categories |
| GET | `/with-stats` | None | List categories with usage stats |
| GET | `/:id` | None | Get a category |
| PATCH | `/:id` | Auth commented out | Update a category |
| DELETE | `/:id` | Auth commented out | Delete a category |

### Availability — `/api/v1/availability`

All routes require Provider or Admin.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/my-availability` | Get the provider's weekly schedule |
| PATCH | `/day/:day` | Update a day's availability |
| POST | `/day/:day/slots` | Add a time slot to a day |
| PATCH | `/day/:day/slots/:slotId` | Update a time slot |
| DELETE | `/day/:day/slots/:slotId` | Remove a time slot |
| PATCH | `/booking-rules` | Update booking rules (min hours, max/day, accepting bookings) |

### Bookings — `/api/v1/bookings`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/` | Family | Create a booking |
| GET | `/my` | Family, Provider | List the current user's bookings |
| GET | `/` | Admin | List all bookings |
| GET | `/earnings/my` | Provider | Get the provider's own earnings |
| GET | `/earnings` | Admin | Get platform-wide earnings |
| GET | `/:bookingId` | None | Get a booking by ID |
| POST | `/:bookingId/accept` | Provider | Accept a booking request |
| POST | `/:bookingId/decline` | Provider | Decline a booking request |
| POST | `/:bookingId/start` | Provider | Mark a booking as started |
| POST | `/:bookingId/complete-job` | Provider | Mark the job as completed |
| POST | `/:bookingId/withdraw` | Family | Withdraw a booking request |
| PATCH | `/:bookingId/reschedule` | Family | Reschedule a booking |
| POST | `/:bookingId/confirm-completion` | Family | Confirm job completion |
| POST | `/:bookingId/cancel` | Family, Provider | Cancel a booking |

### Payments — `/api/v1/payments`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/webhook` | None (HMAC-verified) | Datatrans payment webhook (legacy gateway) |
| POST | `/stripe/webhook` | None (Stripe-signature verified) | Stripe payment webhook |
| GET | `/my` | Family, Provider | List the current user's payments |
| GET | `/` | Admin | List all payments |
| GET | `/:paymentId` | Route commented out | Get a payment by ID |
| GET | `/booking/:bookingId` | Route commented out | Get payment for a booking |
| POST | `/:paymentId/refund` | Route commented out | Refund a payment |

Also outside `/api/v1`: **GET `/payments/return`** — temporary HTML landing page shown after a Datatrans checkout redirect (marked in code as temporary, to be removed once a real frontend page exists).

### Chat — `/api/v1/chat`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/create` | Family, Provider, Admin | Start/get a chat with another user |
| GET | `/my-chat-list` | Family, Provider, Admin | List the current user's chats |
| GET | `/all-users` | Admin | List all users (for admin chat access) |
| PATCH | `/leave-chat/:chatId` | Family, Provider, Admin | Leave a chat |
| GET | `/:chatId` | Family, Provider, Admin | Get a chat by ID |

### Messages — `/api/v1/message`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/send` | Family, Provider, Admin | Send a message (REST fallback to the socket `send-message` event) |
| POST | `/file-upload` | Family, Provider, Admin | Upload message images (multipart: `images` ×10) |
| PATCH | `/update/:msgId` | Family, Provider, Admin | Edit a message |
| PATCH | `/seen/:chatId` | Family, Provider, Admin | Mark messages in a chat as seen |
| PATCH | `/approve/:messageId` | None | Approve a pending message |
| PATCH | `/reject/:messageId` | None | Reject a pending message |
| DELETE | `/delete/:msgId` | `user`, `admin` (raw role strings) | Delete a message |
| GET | `/:chatId` | Family, Provider, Admin | Get messages in a chat |

### Calls — `/api/v1/calls`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/my-calls` | Family, Provider, Admin | List the current user's call history |
| GET | `/:id` | Family, Provider, Admin | Get a call record by ID |

> Live call signaling (initiate/offer/answer/ICE/reject/cancel/end) happens over Socket.IO, not REST — see [Notifications / Realtime Features](#notifications--realtime-features) and `docs/call-socket-events.md`.

### Reviews — `/api/v1/reviews`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/create` | Family, Provider | Create a review |
| GET | `/my-reviews` | Family, Provider, Admin | List the current user's reviews |
| GET | `/user/:userId` | None | List reviews for a user |
| GET | `/booking/:bookingId` | None | Get the review for a booking |
| GET | `/:id` | None | Get a review by ID |
| PATCH | `/:id` | Family, Provider | Update a review |
| PATCH | `/:id/reply` | Family, Provider | Reply to a review |
| DELETE | `/:id` | Family, Provider, Admin | Delete a review |

### Reports — `/api/v1/reports`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/` | Family, Provider | File a report against a user |
| GET | `/my-reports` | Family, Provider | List reports filed by the current user |
| GET | `/` | Admin | List all reports |
| GET | `/:id` | Family, Provider, Admin | Get a report by ID |
| PATCH | `/:id/status` | Admin | Update report status |
| DELETE | `/:id` | Family, Provider, Admin | Delete a report |

### Support — `/api/v1/support`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/create` | Family, Provider, Admin | Open a support ticket (multipart: `attachment`) |
| GET | `/my-tickets` | Family, Provider, Admin | List the current user's tickets |
| GET | `/all-tickets` | Admin | List all tickets |
| GET | `/:id` | Family, Provider, Admin | Get a ticket by ID |
| POST | `/:id/messages` | Family, Provider, Admin | Add a message to a ticket (multipart: `attachment`) |
| PATCH | `/:id/status` | Admin | Update ticket status |

### Feedback — `/api/v1/feedback`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/add` | Family, Provider, Admin | Submit feedback |
| GET | `/` | Auth commented out | List feedback |
| GET | `/admin` | Admin | List feedback (admin view) |
| GET | `/:id` | Family, Provider, Admin | Get feedback by ID |
| PATCH | `/update/:id` | Family, Provider, Admin | Update feedback |
| PATCH | `/verify/:id` | Family, Provider, Admin | Verify feedback |
| DELETE | `/:id` | Family, Provider, Admin | Delete feedback |

### Notifications — `/api/v1/notifications`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/create` | `user`, `admin` (raw role strings) | Create a notification |
| GET | `/all-notifications` | `user` | List all notifications |
| GET | `/my-notifications` | `user`, `admin` | List the current user's notifications |
| PATCH | `/mark-read/:id` | `user` | Mark one notification as read |
| PATCH | `/read-all` | `user`, `admin` | Mark all notifications as read |
| DELETE | `/delete/:id` | `user` | Delete a notification |

### Settings — `/api/v1/settings`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/privacy` | None | Get privacy policy content |
| GET | `/termAndConditions` | None | Get terms & conditions content |
| GET | `/aboutUs` | None | Get about-us content |
| PUT | `/` | None | Update settings content by key |

### Overview — `/api/v1/admin/overview` and `/api/v1/overview`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/admin/overview` | Auth commented out | Platform-wide dashboard stats |
| GET | `/api/v1/admin/overview/bookings` | Auth commented out | Booking stats |
| GET | `/api/v1/admin/overview/earnings` | Auth commented out | Earnings stats |
| GET | `/api/v1/overview/my` | Family, Provider | Current user's personal dashboard stats |

## Authentication & Authorization

- **Strategy:** JWT access + refresh tokens (`jsonwebtoken`), issued in `src/app/modules/auth/auth.service.ts`. Access and refresh tokens use separate secrets/expirations (`JWT_ACCESS_SECRET`/`JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`/`JWT_REFRESH_EXPIRES_IN`).
- **Sending the token:** clients pass the access token via the `Authorization` or `token` request header. Read and verified in `src/app/middleware/auth.ts`.
- **`auth(...roles)` middleware:** verifies the JWT, loads the user via `User.IsUserExistById`, and checks the user's `role` against the allowed roles list before calling `next()`.
- **Password storage:** hashed with `bcrypt` (cost from `BCRYPT_SALT_ROUNDS`) in a Mongoose `pre('save')` hook on the `User` model, and re-hashed on password change/reset.
- **OTP verification:** used for account creation and forgot-password. OTPs are stored in the `Otp` collection with a purpose (`email-verification` / `reset-password` / `forget-password`), delivered by email (Nodemailer) or SMS (Twilio, phone-based forgot-password only), and expire per `OTP_EXPIRE_TIME`. A short-lived JWT (`OTP_TOKEN_EXPIRE_TIME`) is issued after successful OTP verification to authorize the subsequent password-reset step.
- **No OAuth/social login** is implemented.

### User roles

Defined as `USER_ROLE` in `src/app/modules/user/user.constants.ts`:

- `admin`
- `provider`
- `family`

> Note: the `User` model's `role` schema field also allows a fourth value, `user`, and a few routes (some `notifications` and `message` endpoints) authorize against the raw strings `'user'`/`'admin'` rather than the `USER_ROLE` constant. Treat `user` as a legacy/generic role value distinct from the three primary roles used across most of the API.

## Payment / Third-Party Integrations

- **Stripe (active gateway):** Checkout Session creation, PaymentIntent capture/cancel, and refunds (`src/app/modules/payment/gateways/stripe/`). Configured via `STRIPE_SECRET_KEY`; webhook signature verified with `STRIPE_WEBHOOK_SECRET` against the `POST /api/v1/payments/stripe/webhook` endpoint.
- **Datatrans (legacy, not invoked):** A full authorize/capture/void/refund integration exists (`src/app/modules/payment/gateways/datatrans/`) with its own webhook (`POST /api/v1/payments/webhook`), but is explicitly marked in code comments as kept for reference/rollback only and not currently used by the active booking/payment flow.
- **Twilio:** Used only to send SMS one-time codes for phone-based "forgot password" (`auth.service.ts`). Not used for calling — audio/video calls are raw WebRTC peer connections signaled over Socket.IO.
- **Nodemailer:** Sends transactional email over Gmail SMTP (`src/app/utils/mailSender.ts`) — used for OTP delivery and a new-user-registration notification email to a fixed internal address.
- **AWS S3:** Configuration fields exist (`S3_BUCKET_ACCESS_KEY`, etc.) but there is no S3 client usage anywhere in the codebase; file storage is local disk only.

## File Uploads

- Handled by `multer` via a factory in `src/app/middleware/fileUpload.ts`, configured per-module to write to a specific subdirectory under `public/uploads/` (e.g. `profile`, `certificates`, `category`, `support`, `chat`).
- Destination is also inferred from field name: files uploaded under fieldname `image` go to `public/uploads/profile`; `introVideo`/`video` go to `public/uploads/video`.
- **Limits:** 50 MB max file size.
- **Allowed types:** images (png, jpg, jpeg, svg, webp), video (mp4, avi, mov, mkv), and documents (pdf, doc, docx).
- Uploaded files are served statically via `express.static('public')`, i.e. reachable at `/uploads/<subfolder>/<filename>`.

## Notifications / Realtime Features

Realtime functionality runs on a **separate Socket.IO server** (own HTTP server, port `SOCKET_PORT`) initialized from `src/socketIo.ts`. Sockets authenticate via a JWT passed in the connection handshake (`auth.token`, or `token`/`authorization` header).

- **Presence:** connected users are tracked in-memory; `onlineUser` is broadcast on connect/disconnect.
- **Chat:** `send-message` (persists a `Message`, emits `newMessage` / `message_received::<chatId>`), `readMessage`, `my-chat-list`.
- **Notifications:** `readNotification` marks all as read and emits an updated `notification` unread count; REST endpoints under `/api/v1/notifications` cover full CRUD.
- **Calls (WebRTC signaling):** full event set — `call:initiate`, `call:offer`, `call:answer`, `call:ice-candidate`, `call:reject`, `call:cancel`, `call:end`, and server-pushed `call:incoming`, `call:accepted`, `call:missed`, `call:rejected`, `call:cancelled`, `call:ended`, `call:peer-disconnected`. Rings time out after 45 seconds. The server only relays signaling data (SDP/ICE) — audio/video media flows peer-to-peer between clients. A complete event-by-event reference with example payloads is documented in [`docs/call-socket-events.md`](docs/call-socket-events.md).

## Cron Jobs

**None.** No `node-cron`, `setInterval`-based scheduler, or other recurring/scheduled job exists in the codebase. (The only `setInterval` in the project is a startup console-spinner animation in `src/server.ts` while MongoDB connects, cleared immediately once the connection is established.)

## Testing

**No automated test suite exists.** The `npm test` script is a stub (`echo "Error: no test specified" && exit 1`), and there are no `*.test.ts`/`*.spec.ts` files anywhere in the project.

## Deployment

- **Build:** `npm run build` compiles TypeScript (`rootDir: src` → `outDir: dist`, per `tsconfig.json`).
- **Run:** `npm run start:prod` runs the compiled `dist/server.js`.
- No Dockerfile, docker-compose file, CI/CD workflow, or process-manager (PM2/Procfile) configuration is present in the repository — deployment tooling beyond the two npm scripts above is not defined in this codebase.
- The server binds two separate ports: the Express API (`PORT`) and the Socket.IO server (`SOCKET_PORT`) — both must be reachable/exposed in whatever hosting environment is used.

## Troubleshooting

- **Server won't start / hangs on "MongoDB connecting":** verify `DATABASE_URL` is correct and MongoDB is reachable; the connection has a 10-second timeout (`connectTimeoutMS`) in `src/server.ts`.
- **401/403 on authenticated routes:** confirm the JWT is sent in the `Authorization` (or `token`) header and matches `JWT_ACCESS_SECRET`; check the calling user's `role` is included in the route's allowed roles.
- **Stripe webhook signature failures:** the webhook route depends on `req.rawBody`, captured by the `express.json({ verify })` hook in `src/app.ts` — ensure no other body-parsing middleware runs before it, and confirm `STRIPE_WEBHOOK_SECRET` matches the endpoint configured in the Stripe dashboard.
- **Uploaded files return 404:** confirm the file was written under `public/uploads/...` and is being requested at the matching static path (files are served from the `public/` directory).
- **Socket connection fails:** ensure the client connects to the `SOCKET_PORT` (not the API `PORT`) and passes a valid access token in the handshake.
- **Missing default admin:** check `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_PHONE` are set; the admin is (re-)seeded on every server startup if it doesn't already exist.

## Security Notes

- **No `.env.example` is committed**, and the `.gitignore` does not exclude the root `.env` file (it only ignores `.env.local.env`/`.*.local` patterns) — verify `.env` is not accidentally committed before pushing.
- Several admin-only-by-design endpoints currently have their `auth(...)` role check **commented out** in source, leaving them open to unauthenticated access: provider approval/rejection and family/provider listing (`user.route.ts`), category create/update/delete (`category.route.ts`), all three admin overview endpoints (`overview.route.ts`), several payment lookup/refund endpoints (`payment.route.ts`), and the feedback list endpoint (`feedback.route.ts`). Review these before any production deployment.
- The `GET /` monitoring dashboard (`src/app/helpers/serverHomePage.ts`) embeds `MONITOR_USERNAME`/`MONITOR_PASSWORD` directly in the returned HTML/JavaScript for a client-side login gate — these credentials are visible in the page source to anyone who requests `/`, which does not provide real access control.
- Password hashes are never returned in API responses (`toJSON` strips `password` on the `User` model), and `NODE_ENV` gates whether error responses include stack traces.
- The legacy Datatrans payment webhook route remains live (verifies via HMAC) even though the gateway is unused elsewhere in the app — consider removing it if it is not needed operationally.
