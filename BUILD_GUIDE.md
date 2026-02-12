# Building & Distributing LogisPro

## Overview

This guide shows how to build installer files and distribute LogisPro to your users.

---

## Prerequisites

### Before Building

1. **Backend must be deployed** 
   - Follow `DEPLOYMENT.md` to deploy to Render.com
   - Get your production API URL
   
2. **Update API URL in `.env`:**
   ```bash
   VITE_API_URL=https://your-app.onrender.com
   ```

3. **Update GitHub info in `electron/main.cjs`** (for auto-update):
   ```javascript
   // Line ~20
   autoUpdater.setFeedURL({
     provider: 'github',
     owner: 'your-github-username',  // ← Change this
     repo: 'ruby-rosette'            // ← Change if needed
   });
   ```

---

## Building Installers

### macOS (.dmg)

**Requirements:**
- Must build on macOS
- Xcode Command Line Tools installed

**Build Command:**
```bash
npm run electron:build:mac
```

**Output:** `dist/` folder contains:
- `LogisPro-1.0.0.dmg` - Universal installer
- `LogisPro-1.0.0-arm64.dmg` - Apple Silicon (M1/M2/M3)
- `LogisPro-1.0.0-x64.dmg` - Intel Macs

**File Size:** ~100-150 MB per file

### Windows (.exe)

**Option 1: Build on Windows Machine**
```bash
npm run electron:build:win
```

**Option 2: Cross-compile from macOS**  
```bash
# Install wine (for Windows code signing)
brew install --cask wine-stable

# Build
npm run electron:build:win
```

**Output:** `dist/` folder contains:
- `LogisPro-Setup-1.0.0.exe` - NSIS installer
- `LogisPro-1.0.0.exe` - Portable version

**Note:** Cross-compiled from Mac won't have code signing.

### Both Platforms

```bash
npm run electron:build:all
```

Builds for macOS, Windows, and Linux.

---

## Build Troubleshooting

### Error: "Module not found"

```bash
# Clean and rebuild
rm -rf node_modules dist
npm install
npm run electron:build:mac
```

### Error: "electron-builder not found"

```bash
npm install --save-dev electron-builder
```

### Build takes too long / timeout

```bash
# Build without compression (faster for testing)
npm run build && electron-builder --mac --dir
```

---

## Code Signing (Optional but Recommended)

### Why Code Sign?

**Without signing:**
- macOS: "App from unidentified developer" warning
- Windows: SmartScreen warning

**With signing:**
- Clean installation, no warnings
- Better user trust

### macOS Code Signing

**Requirements:**
- Apple Developer Account ($99/year)
- Developer ID Application certificate

**Steps:**
1. Join Apple Developer Program
2. Create certificates in Xcode
3. Update `electron-builder.json`:
   ```json
   {
     "mac": {
       "identity": "Developer ID Application: Your Name (TEAM_ID)"
     }
   }
   ```

### Windows Code Signing

**Requirements:**
- Code Signing Certificate ($200-400/year from Sectigo, DigiCert, etc.)

**Steps:**
1. Purchase certificate
2. Install certificate
3. Update `electron-builder.json`:
   ```json
   {
     "win": {
       "certificateFile": "path/to/cert.pfx",
       "certificatePassword": "password"
     }
   }
   ```

---

## Distribution Workflow

### Step 1: Build for Distribution

```bash
# Make sure .env has production API URL
cat .env  # Verify VITE_API_URL

# Build
npm run electron:build:mac   # or :win
```

### Step 2: Test the Installer

**macOS:**
1. Open `dist/` folder
2. Double-click `LogisPro-1.0.0.dmg`
3. Drag to Applications
4. Open from Applications
5. If warning appears: Right-click → Open
6. Test login with admin credentials

**Windows:**
1. Double-click `LogisPro-Setup-1.0.0.exe`
2. Click through installer
3. Launch app
4. If SmartScreen: Click "More info" → "Run anyway"
5. Test login

### Step 3: Distribute to Users

**Methods:**

#### A. Direct File Sharing (Simple)
1. Upload `.dmg` or `.exe` to:
   - Google Drive
   - Dropbox  
   - WeTransfer
2. Share link with users
3. Include installation instructions

#### B. GitHub Releases (Recommended)
1. Create GitHub repository (if not exists)
2. Push code to GitHub
3. Create new release:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. Go to GitHub → Releases → Create Release
5. Upload installers as assets
6. Users download from releases page

#### C. Own Website/Server
- Host files on your server
- Provide download links

---

## User Installation Guide

### For macOS Users

**What you send:**
- File: `LogisPro-1.0.0.dmg`
- Size: ~150 MB

**Instructions for users:**

1. **Download** the file you sent
2. **Double-click** `LogisPro-1.0.0.dmg`
3. **Drag** LogisPro icon to Applications folder
4. **Eject** the disk image
5. **Open** Applications folder
6. **Right-click** LogisPro → **Open** (first time only)
7. Click **Open** on security warning
8. **Login** with credentials you provided

### For Windows Users

**What you send:**
- File: `LogisPro-Setup-1.0.0.exe`
- Size: ~120 MB

**Instructions for users:**

1. **Download** the file you sent
2. **Double-click** `LogisPro-Setup-1.0.0.exe`
3. If SmartScreen warning appears:
   - Click **"More info"**
   - Click **"Run anyway"**
4. Click through installer (Next → Next → Install)
5. Launch LogisPro from Desktop or Start Menu
6. **Login** with credentials you provided

---

## Creating User Accounts

### Via Admin Panel

1. Login as admin
2. Go to **Admin Panel** (Settings → Admin)
3. Navigate to **Users** tab
4. Click **"Create User"** (you may need to add this button)
5. Fill in:
   - Email
   - Full Name
   - Password (give to user)
   - Role
   - Department

### Via Database (Alternative)

```bash
# Connect to production database
psql $DATABASE_URL

# Create user
INSERT INTO users (email, password_hash, full_name, role, status)
VALUES ('user@company.com', 
        '$2a$10$...hashed_password', 
        'John Doe',
        'USER',
        'ACTIVE');

# Generate license
INSERT INTO licenses (license_key, user_id, type, max_devices)
SELECT 
  'XXXX-XXXX-XXXX-XXXX',  -- Generate random
  id,
  'STANDARD',
  1
FROM users WHERE email = 'user@company.com';
```

### Credentials to Send

Send users:
```
LogisPro Account Credentials

Email: user@company.com
Password: TempPassword123

Download link: [your link]

Installation guide: [link to guide]

Support: admin@yourcompany.com
```

---

## Auto-Update Setup

### 1. Enable GitHub Releases

In `electron/main.cjs`, update:
```javascript
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'YOUR-GITHUB-USERNAME',  // ← Update this
  repo: 'ruby-rosette'
});
```

### 2. Create Release

```bash
# Update version
npm version patch  # 1.0.0 → 1.0.1

# Build new version
npm run electron:build:mac

# Create Git tag
git tag v1.0.1
git push origin v1.0.1

# Create GitHub Release
# Upload dist/LogisPro-1.0.1.dmg
```

### 3. Users Get Auto-Update

- When app starts, checks for updates
- Downloads in background
- Prompts user to restart
- Installs automatically

---

## Version Management

### Semantic Versioning

- **Major** (1.0.0 → 2.0.0): Breaking changes
- **Minor** (1.0.0 → 1.1.0): New features
- **Patch** (1.0.0 → 1.0.1): Bug fixes

### Release Checklist

Before each release:

- [ ] Test all features work
- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md`
- [ ] Build installers
- [ ] Test installers on clean machines
- [ ] Create Git tag
- [ ] Create GitHub release
- [ ] Upload installers
- [ ] Notify users

---

## File Sizes & Requirements

### Installer Sizes

| Platform | Size | Download Time (10 Mbps) |
|----------|------|------------------------|
| macOS .dmg | ~150 MB | ~2 minutes |
| Windows .exe | ~120 MB | ~1.5 minutes |

### User System Requirements

**macOS:**
- macOS 10.13 (High Sierra) or later
- 4 GB RAM minimum
- 500 MB disk space
- Internet connection (for login)

**Windows:**
- Windows 10 or later
- 4 GB RAM minimum
- 500 MB disk space
- Internet connection (for login)

---

## Quick Reference

### Build Commands

```bash
# macOS
npm run electron:build:mac

# Windows  
npm run electron:build:win

# Both
npm run electron:build:all
```

### Files to Send Users

```
dist/
├── LogisPro-1.0.0.dmg          ← Send this for Mac
└── LogisPro-Setup-1.0.0.exe    ← Send this for Windows
```

### What Users Need

1. Installer file
2. Credentials (email/password)
3. Installation guide
4. Support contact

---

## Support & Troubleshooting

### Common User Issues

**"Cannot open app - unidentified developer"** (macOS)
- Solution: Right-click → Open

**"Windows protected your PC"** (Windows)
- Solution: More info → Run anyway

**"License invalid"**
- Check user has license in admin panel
- Verify license not revoked

**"Device already bound"**
- Reset device binding in admin panel
- User → Reset Device

---

## Next Steps After Distribution

1. ✅ Users install app
2. ✅ Users login successfully  
3. Monitor usage in admin panel
4. Plan feature updates
5. Gather user feedback
6. Release updates via GitHub

**You're ready to distribute!** 🚀

For deployment help, see `DEPLOYMENT.md`
For quick start, see `QUICKSTART.md`
