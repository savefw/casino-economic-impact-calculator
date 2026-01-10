#!/bin/bash

# Define the development port
DEV_PORT=5000

# Kill any existing process on the development port
PID_DEV=$(lsof -t -i :$DEV_PORT)
if [ -n "$PID_DEV" ]; then
  echo "Killing process on port $DEV_PORT (PID: $PID_DEV)"
  kill -9 $PID_DEV
else
  echo "No process found on port $DEV_PORT"
fi

# NOTE: We do NOT kill port 80 or 8002 as those are used by the production Docker instance.

# Start the server
echo "Starting server on port $DEV_PORT (Development Environment)..."

# Build Tailwind CSS
echo "Building Assets..."
cd /root/SaveFW || exit 1
npm run copy-libs
npm run build:css

# Ensure the app runs with the correct content root/appsettings
cd /root/SaveFW/SaveFW.Server || exit 1

# Clean old wwwroot artifacts if they exist
rm -rf /root/SaveFW/SaveFW.Server/wwwroot

# Build the project
echo "Building SaveFW.Server..."
/root/.dotnet/dotnet build /root/SaveFW/SaveFW.Server/SaveFW.Server.csproj

# Run the server in the background
# ASPNETCORE_URLS sets the listening port to 5000
# ASPNETCORE_ENVIRONMENT=Development ensures we use appsettings.Development.json (which should point Valhalla to 8003 or similar)
env ASPNETCORE_ENVIRONMENT=Development DOTNET_ROOT=/root/.dotnet PATH=/root/.dotnet:$PATH nohup /root/.dotnet/dotnet /root/SaveFW/SaveFW.Server/bin/Debug/net10.0/SaveFW.Server.dll --urls "http://0.0.0.0:$DEV_PORT" > /root/server.log 2>&1 &

echo "Server process started."
sleep 2
tail -n 40 /root/server.log
echo "To follow logs: tail -f /root/server.log"