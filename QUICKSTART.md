# LogisPro Quick Start

## Cách 1: Automatic Setup (Recommended)

```bash
# Run setup script
./setup.sh
```

Script sẽ tự động:
- ✅ Install PostgreSQL (nếu chưa có)
- ✅ Create database `logispro`
- ✅ Generate JWT secret
- ✅ Install dependencies
- ✅ Initialize schema
- ✅ Seed data

## Cách 2: Manual Setup

### 1. Install PostgreSQL

```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Or use Postgres.app: https://postgresapp.com/
```

### 2. Create Database

```bash
createdb logispro
```

### 3. Setup Environment

```bash
cd server
cp .env.example .env

# Edit .env and set:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/logispro
# JWT_SECRET=your-secret-key
```

### 4. Initialize Database

```bash
cd server
npm install
npm run db:init    # Create tables
npm run db:seed    # Add sample data
```

### 5. Start Application

**Terminal 1 - Server:**
```bash
cd server
npm run dev
# Server runs on http://localhost:3001
```

**Terminal 2 - Electron App:**
```bash
npm run electron:dev
```

### 6. Login

- Email: `admin@logispro.vn`
- Password: `admin123`

## 🔐 Admin Access Setup

After first login:

1. Check console for your device ID
2. Copy it
3. Add to `server/.env`:
   ```
   PRIMARY_ADMIN_DEVICE_ID=your-device-id-here
   ```
4. Restart server
5. Login again → You now have admin access!

## 🧪 Available Accounts

| Email | Password | Role | License |
|-------|----------|------|---------|
| admin@logispro.vn | admin123 | ADMIN | PREMIUM |
| logistics@logispro.vn | admin123 | LOGISTICS_MANAGER | STANDARD |
| sales@logispro.vn | admin123 | SALES | STANDARD |

## 📊 Database Commands

```bash
cd server

# Reset database
npm run db:init

# Reseed data
npm run db:seed

# Connect to database
psql logispro
```

## 🚨 Troubleshooting

**PostgreSQL not found:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Database exists error:**
```bash
dropdb logispro
createdb logispro
```

**Connection refused:**
```bash
# Check if PostgreSQL is running
brew services list

# Start if not running
brew services start postgresql@15
```

**Port 3001 already in use:**
```bash
# Change PORT in server/.env
PORT=3002
```
