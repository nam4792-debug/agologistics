#!/bin/bash

echo "🚀 LogisPro - Quick Setup Script"
echo "================================"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL is not installed!"
    echo ""
    echo "📦 Installing PostgreSQL using Homebrew..."
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew is not installed. Please install it first:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
    
    brew install postgresql@15
    brew services start postgresql@15
    echo "✅ PostgreSQL installed and started"
    echo ""
fi

# Check if database exists
echo "📊 Checking database..."
if psql -lqt | cut -d \| -f 1 | grep -qw logispro; then
    echo "⚠️  Database 'logispro' already exists"
    read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        dropdb logispro
        createdb logispro
        echo "✅ Database recreated"
    fi
else
    createdb logispro
    echo "✅ Database 'logispro' created"
fi

echo ""

# Create .env file if it doesn't exist
if [ ! -f "server/.env" ]; then
    echo "📝 Creating .env file..."
    cp server/.env.example server/.env
    
    # Generate random JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    
    # Update .env with generated secret
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-super-secret-jwt-key-change-in-production/$JWT_SECRET/" server/.env
    else
        # Linux
        sed -i "s/your-super-secret-jwt-key-change-in-production/$JWT_SECRET/" server/.env
    fi
    
    echo "✅ .env file created with random JWT secret"
else
    echo "✅ .env file already exists"
fi

echo ""

# Install dependencies
echo "📦 Installing server dependencies..."
cd server
npm install
cd ..
echo "✅ Dependencies installed"

echo ""

# Initialize database
echo "🗄️  Initializing database schema..."
cd server
npm run db:init
cd ..

echo ""

# Seed database
echo "🌱 Seeding database..."
cd server
npm run db:seed
cd ..

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Terminal 1: cd server && npm run dev"
echo "   2. Terminal 2: npm run electron:dev"
echo "   3. Login with: admin@logispro.vn / admin123"
echo ""
echo "⚠️  IMPORTANT: After first login, copy your device ID from console"
echo "   Then set it as PRIMARY_ADMIN_DEVICE_ID in server/.env"
echo ""
