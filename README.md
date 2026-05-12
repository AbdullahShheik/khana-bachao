# Khana Bachao

A web-based platform connecting food providers (restaurants, bakeries, catering services) with NGOs to reduce food waste and combat hunger by enabling efficient sharing of surplus food.

## Project Overview

**Khana Bachao** (meaning "Save Food" in Urdu/Hindi) is a full-stack application designed to bridge the gap between food providers who have surplus food and NGOs/charities that need to feed underprivileged populations. The platform facilitates easy listing, claiming, and communication for a sustainable food distribution ecosystem.

## Table of Contents

- [Tech Stack](#-tech-stack)
- [Features](#-features)
- [Project Structure](#-project-structure)
- [Installation & Setup](#-installation--setup)
- [Running the Application](#-running-the-application)
- [API Endpoints](#-api-endpoints)
- [Database Schema](#-database-schema)
- [Environment Variables](#-environment-variables)
- [Development](#-development)

## 🛠 Tech Stack

### Backend
- **Framework:** FastAPI 0.135.2
- **Server:** Uvicorn 0.42.0
- **Database:** MySQL (PyMySQL)
- **ORM:** SQLAlchemy 2.0.48
- **Data Validation:** Pydantic 2.12.5
- **Authentication:** JWT (Python-Jose), Bcrypt for password hashing
- **Email:** SMTP (Gmail)
- **WhatsApp Integration:** Twilio
- **Additional Libraries:**
  - `fastapi-cors` for CORS middleware
  - `email-validator` for email validation
  - `python-multipart` for file uploads

### Frontend
- **Framework:** React 19.2.4
- **Build Tool:** Vite 8.0.1
- **Router:** React Router DOM 7.14.0
- **HTTP Client:** Axios 1.14.0
- **UI Icons:** Lucide React 1.7.0
- **Styling:** Custom CSS
- **Dev Tools:** ESLint, Vite plugins for React optimization

### Infrastructure
- **Python Environment:** Virtual environment (venv) with site-packages
- **File Storage:** Local file system for uploaded images (`/uploads`)

## Features

### User Management
- **Dual-Role System:** Food Providers and NGO accounts
- **Email Verification:** Automated email verification for registration
- **WhatsApp Verification:** Optional WhatsApp verification codes via Twilio
- **Secure Authentication:** JWT-based token authentication with role-based access control
- **Profile Management:** Update profile information and notification preferences

### Food Listings
- **Create Listings:** Food providers can post available surplus food
  - Multiple food items per listing
  - Location-based information
  - Availability window (until time)
  - Image uploads
- **List Management:** View, update, and delete listings
- **Status Tracking:** Track listing status (active, claimed, completed)
- **Search & Filter:** NGOs can discover available food based on location and availability

### Claiming System
- **Listing Claims:** NGOs can claim available food listings
- **Claim Management:** Track and manage claimed listings
- **Completion Workflow:** Mark claims as completed
- **Notifications:** Automatic notifications when listings are claimed

### Communication
- **Real-Time Chat:** Direct messaging between food providers and NGOs
  - Per-listing chat threads
  - Message history
  - Read status tracking (unread message indicators)
- **Message Types:** Text-based communication
- **Chat Threads:** Organized by listing and claim

### Notifications
- **Email Notifications:**
  - New listing announcements to subscribed NGOs
  - Claim notifications to food providers
  - Completion updates
- **In-App Notifications:** Real-time notification center
- **Notification Preferences:** Users can enable/disable email notifications
- **Notification History:** View last 20 notifications

### Dashboard
- **Food Provider Dashboard (FPDashboard):**
  - View all posted listings
  - See incoming claims from NGOs
  - Manage active and completed listings
  - Chat with NGOs about claims
  - Track notification history
  
- **NGO Dashboard (NGODashboard):**
  - Discover available food listings
  - Claim food listings
  - Manage claimed listings
  - Chat with food providers
  - Track claimed items and delivery status

### File Management
- **Image Uploads:** Food providers can upload images for listings
- **Static File Serving:** Uploaded images accessible via `/uploads` endpoint
- **File Storage:** Local filesystem storage

## Project Structure

```
khana-bachao/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app initialization
│   │   ├── auth.py                 # JWT token creation and verification
│   │   ├── database.py             # SQLAlchemy database setup
│   │   ├── models.py               # Database models (User, Listing, Chat, etc.)
│   │   ├── schemas.py              # Pydantic request/response schemas
│   │   ├── email_service.py        # Email notification service
│   │   ├── whatsapp_service.py     # Twilio WhatsApp integration
│   │   └── routes/
│   │       ├── auth.py             # Authentication endpoints
│   │       ├── listings.py         # Listing CRUD & claims
│   │       ├── chats.py            # Chat & messaging endpoints
│   │       ├── notifications.py    # Notification endpoints
│   │       └── upload.py           # File upload endpoints
│   ├── uploads/                    # Directory for uploaded images
│   ├── requirements.txt            # Python dependencies
│   ├── run.py                      # Application entry point
│   └── khana-bachao-dev/           # Virtual environment
│
├── frontend-react/
│   ├── src/
│   │   ├── App.jsx                 # Main app component
│   │   ├── main.jsx                # React entry point
│   │   ├── pages/
│   │   │   ├── Login.jsx           # Authentication page
│   │   │   ├── FPDashboard.jsx     # Food Provider dashboard
│   │   │   ├── NGODashboard.jsx    # NGO dashboard
│   │   │   ├── ListingDetail.jsx   # Listing detail view
│   │   │   └── ChatWindow.jsx      # Chat interface
│   │   ├── styles/
│   │   │   └── global.css          # Global styles
│   │   └── assets/                 # Static assets
│   ├── public/                     # Public static files
│   ├── package.json                # Node dependencies
│   ├── vite.config.js              # Vite configuration
│   ├── index.html                  # HTML entry point
│   └── eslint.config.js            # ESLint configuration
│
└── README.md                       # This file
```

## Installation & Setup

### Prerequisites
- Python 3.9+
- Node.js 16+ and npm
- MySQL database
- Git

### Backend Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/khana-bachao.git
   cd khana-bachao/backend
   ```

2. **Create and activate virtual environment:**
   ```bash
   python -m venv khana-bachao-dev
   # On Windows
   khana-bachao-dev\Scripts\activate
   # On macOS/Linux
   source khana-bachao-dev/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   Create a `.env` file in the `backend` directory:
   ```
   DATABASE_URL=mysql+pymysql://username:password@localhost/khana_bachao
   SECRET_KEY=your-secret-key-here
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   
   # Email Configuration
   SENDER_EMAIL=your-email@gmail.com
   SENDER_PASSWORD=your-app-password
   
   # WhatsApp/Twilio Configuration
   TWILIO_ACCOUNT_SID=your-twilio-account-sid
   TWILIO_AUTH_TOKEN=your-twilio-auth-token
   TWILIO_WHATSAPP_NUMBER=your-twilio-whatsapp-number
   ```

5. **Set up database:**
   ```bash
   # Create MySQL database
   mysql -u root -p
   CREATE DATABASE khana_bachao;
   ```

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd ../frontend-react
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure API endpoint:**
   Update the API base URL in your HTTP client configuration (typically `src/main.jsx` or environment variables):
   ```
   VITE_API_URL=http://localhost:8000
   ```

## Running the Application

### Start Backend Server

```bash
cd backend
# Activate virtual environment
khana-bachao-dev\Scripts\activate  # Windows
# or
source khana-bachao-dev/bin/activate  # macOS/Linux

# Run the server
python run.py
```

The backend will be available at `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs` (Swagger UI)
- Alternative Docs: `http://localhost:8000/redoc` (ReDoc)

### Start Frontend Development Server

```bash
cd frontend-react
npm run dev
```

The frontend will be available at `http://localhost:5173`

## API Endpoints

### Authentication
- `POST /auth/signup` - Register new user (food provider or NGO)
- `POST /auth/login` - User login
- `POST /auth/verify-email` - Verify email with code
- `POST /auth/resend-verification-code` - Resend verification code
- `POST /auth/send-whatsapp-verification` - Send WhatsApp verification code

### Listings
- `GET /listings` - Get all listings
- `GET /listings/{listing_id}` - Get listing details
- `POST /listings` - Create new listing (Food Provider only)
- `PUT /listings/{listing_id}` - Update listing (Food Provider only)
- `DELETE /listings/{listing_id}` - Delete listing (Food Provider only)
- `PUT /listings/{listing_id}/status` - Update listing status
- `POST /listings/{listing_id}/claim` - Claim a listing (NGO only)
- `GET /listings/{listing_id}/claims` - Get claims for a listing

### Chats & Messages
- `GET /chats` - Get all chat threads for current user
- `GET /chats/{chat_id}` - Get chat details with messages
- `GET /chats/{chat_id}/unread-summary` - Get unread message count
- `POST /chats/{chat_id}/messages` - Send message
- `PUT /chats/{chat_id}/mark-read` - Mark messages as read

### Notifications
- `GET /notifications` - Get user notifications (last 20)
- `PUT /notifications/{notification_id}/read` - Mark notification as read

### File Upload
- `POST /upload` - Upload image file

## 🗄 Database Schema

### Core Tables

**food_providers**
- `id` (PK)
- `name`, `email`, `phone`
- `password_hash`
- `is_verified`, `verification_code`
- `email_notifications`
- `created_at`

**ngos**
- `id` (PK)
- `ngo_name`, `email`, `phone`
- `password_hash`
- `verification_status` (pending/verified/rejected)
- `email_notifications`
- `created_at`

**food_listings**
- `id` (PK)
- `food_provider_id` (FK)
- `location`, `available_until`
- `status` (active/claimed/completed)
- `created_at`, `updated_at`

**food_items**
- `id` (PK)
- `listing_id` (FK)
- `item_name`, `quantity`

**listing_claims**
- `id` (PK)
- `listing_id` (FK)
- `ngo_id` (FK)
- `status` (pending/accepted/completed)
- `claimed_at`, `completed_at`

**chats**
- `id` (PK)
- `claim_id` (FK)
- `created_at`

**messages**
- `id` (PK)
- `chat_id` (FK)
- `sender_id`, `sender_role`
- `content`
- `sent_at`

**notifications**
- `id` (PK)
- `recipient_id`, `recipient_role`
- `title`, `body`
- `is_read`
- `created_at`

## Environment Variables

### Backend (.env file)

```env
# Database
DATABASE_URL=mysql+pymysql://username:password@hostname/database_name

# JWT
SECRET_KEY=your-random-secret-key-for-jwt-signing
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Email (Gmail SMTP)
SENDER_EMAIL=your-gmail@gmail.com
SENDER_PASSWORD=your-gmail-app-password

# Twilio (WhatsApp)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_NUMBER=+1234567890

# Server
HOST=0.0.0.0
PORT=8000
```

### Frontend (.env file)

```env
VITE_API_URL=http://localhost:8000
```

## Development

### Code Structure Best Practices

1. **Backend:**
   - Follow FastAPI conventions
   - Use Pydantic schemas for validation
   - Implement proper error handling
   - Use SQLAlchemy ORM patterns
   - Keep routes modular in `/routes` directory

2. **Frontend:**
   - Component-based architecture
   - Use React hooks for state management
   - Axios for API calls
   - Responsive CSS styling
   - ESLint for code quality

### Adding New Features

1. **Database Changes:**
   - Modify models in `backend/app/models.py`
   - Update schemas in `backend/app/schemas.py`

2. **Backend Endpoints:**
   - Add route in appropriate file under `backend/app/routes/`
   - Include proper authentication and validation

3. **Frontend Pages:**
   - Create new component in `frontend-react/src/pages/`
   - Add route to `App.jsx`
   - Import and use Axios for API calls

## Key Technologies Explained

### FastAPI
- Modern, fast Python web framework for building APIs
- Automatic API documentation (Swagger UI, ReDoc)
- Built-in dependency injection system
- Type hints for better IDE support

### React + Vite
- React for building interactive user interfaces
- Vite for fast build tooling and development server
- React Router for client-side routing

### SQLAlchemy
- Python SQL toolkit and Object-Relational Mapping (ORM)
- Database-agnostic SQL expressions
- Automatic schema creation and management

### JWT Authentication
- Stateless authentication using tokens
- Secure token generation and validation
- Role-based access control (RBAC)

## Contributing

1. Create a feature branch (`git checkout -b feature/AmazingFeature`)
2. Commit changes (`git commit -m 'Add AmazingFeature'`)
3. Push to branch (`git push origin feature/AmazingFeature`)
4. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Team

Developed as a Software Engineering project at HU (Semester 6).

## Support

For issues, questions, or suggestions, please open an issue on GitHub or contact the development team.

---

**Last Updated:** May 2026
**Status:** Active Development
