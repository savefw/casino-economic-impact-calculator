#!/bin/bash

# Kill process on port 80
PID80=$(lsof -t -i :80)
if [ -n "$PID80" ]; then
  echo "Killing process on port 80 (PID: $PID80)"
  kill -9 $PID80
else
  echo "No process found on port 80"
fi

# Kill process on port 8002
PID8002=$(lsof -t -i :8002)
if [ -n "$PID8002" ]; then
  echo "Killing process on port 8002 (PID: $PID8002)"
  kill -9 $PID8002
else
  echo "No process found on port 8002"
fi

# Start the server
echo "Starting server..."
# Ensure the app runs with the correct content root/appsettings
cd /root/SaveFW/SaveFW.Server || exit 1
# Using full path to dotnet to be safe, though environment might have it
env DOTNET_ROOT=/root/.dotnet PATH=/root/.dotnet:$PATH nohup /root/.dotnet/dotnet /root/SaveFW/SaveFW.Server/bin/Debug/net10.0/SaveFW.Server.dll --urls "http://0.0.0.0:80" > /root/server.log 2>&1 &

echo "Server process started. Tailing logs..."
sleep 2
tail -n 20 -f /root/server.log
