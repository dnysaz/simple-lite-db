#!/bin/bash

echo "🚀 Starting SimpleLiteDB Update Process..."

# 1. Stop the existing service (killing process on port 5117)
echo "🛑 Stopping current service on port 5117..."
PID=$(lsof -t -i:5117)
if [ -z "$PID" ]; then
    echo "⚠️ No process found on port 5117."
else
    kill -9 $PID
    echo "✅ Service stopped (PID: $PID)."
fi

# 2. Pull latest changes
echo "📥 Pulling latest changes from Git..."
git pull origin main

# 3. Install/Update dependencies
echo "📦 Updating dependencies..."
pip install -r requirements.txt

# 4. Start the service again
echo "✨ Starting SimpleLiteDB..."
# We use nohup to keep it running in the background, or just run it normally
# If you use PM2, replace this with: pm2 restart all
nohup python3 app.py > slite.log 2>&1 &

echo "✅ Update complete! SimpleLiteDB is running in the background."
echo "📝 Logs are being written to slite.log"
echo "🌐 Dashboard available at http://localhost:5117/dashboard"
