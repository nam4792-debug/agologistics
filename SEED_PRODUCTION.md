# Production Database Seeding Guide

## Option 1: Via Render Shell (Recommended)

1. **Go to Render Dashboard**
   - Open: https://dashboard.render.com
   - Navigate to your Web Service: `logispro-api`

2. **Open Shell**
   - Click "Shell" tab
   - Wait for terminal to load

3. **Run Seed Script**
   ```bash
   node seed-production.js
   ```

4. **Verify**
   ```bash
   # Should see:
   # ✅ Admin user: admin@logispro.vn
   # ✅ License: XXXX-XXXX-XXXX-XXXX
   # ✅ User: logistics@logispro.vn
   # ✅ User: sales@logispro.vn
   ```

---

## Option 2: Via API (If Shell doesn't work)

```bash
# Create admin user via API
curl -X POST https://logispro-api.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@logispro.vn",
    "password": "admin123",
    "fullName": "Admin User",
    "role": "ADMIN"
  }'
```

---

## Option 3: Via Local psql (If you have connection)

```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://logispro:Ke91QWyXAIFFsG7nQMuJzj4si1XzE5LO@dpg-d66rsvjnv86c73d9q3g0-a.oregon-postgres.render.com/logispro"

# Run from server directory
cd server
export NODE_ENV=production
node seed-production.js
```

---

## What Gets Created

### Users
- **admin@logispro.vn** / admin123 (ADMIN role)
- **logistics@logispro.vn** / admin123 (USER role)
- **sales@logispro.vn** / admin123 (USER role)

### Licenses
- 1 PREMIUM license for admin (99 devices)
- 2 STANDARD licenses for users (1 device each)

### Next Steps After Seeding

1. **Test Login**
   - Open production installer
   - Login with admin@logispro.vn / admin123
   - Device will auto-bind

2. **Whitelist Admin Device**
   - Get device ID from app console
   - Add to admin_whitelist table
   - Or use admin panel after login

3. **Create More Users**
   - Via admin panel
   - Or via API endpoint

---

## Troubleshooting

### "Connection timeout"
- Render free tier may have cold starts
- Wait 30-60 seconds
- Try again

### "User already exists"
- Seed script uses ON CONFLICT
- Safe to run multiple times
- Updates password if user exists

### "Cannot connect to database"
- Check DATABASE_URL is set
- Verify SSL is enabled
- Check Render database is running

---

## Quick Check

After seeding, verify with:

```bash
# Test login
curl -X POST https://logispro-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@logispro.vn",
    "password": "admin123",
    "deviceId": "test-device-123",
    "deviceName": "Test Device",
    "osInfo": "macOS"
  }'

# Should return JWT token and user info
```

Done! 🎉
