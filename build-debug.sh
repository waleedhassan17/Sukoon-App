#!/bin/bash

#========================================
# Sukoon App - Debug APK Build Script
#========================================
# Builds and downloads a debug APK from EAS
# Usage: ./build-debug.sh

set -e

cd "$(dirname "$0")"

echo "🚀 Sukoon - Debug Build Script"
echo "================================"
echo ""

# Check if logged into EAS
echo "✓ Checking EAS login..."
if ! eas whoami > /dev/null 2>&1; then
  echo "❌ Not logged into EAS. Run: eas login"
  exit 1
fi

# Submit build
echo ""
echo "📤 Submitting debug build to EAS..."
BUILD_OUTPUT=$(eas build --platform android --profile development --no-wait 2>&1)
BUILD_ID=$(echo "$BUILD_OUTPUT" | grep -oP 'builds/\K[a-f0-9-]+' | head -1)

if [ -z "$BUILD_ID" ]; then
  echo "❌ Failed to extract build ID"
  echo "Output: $BUILD_OUTPUT"
  exit 1
fi

echo "✅ Build submitted!"
echo ""
echo "📊 Build Details:"
echo "  Platform: Android"
echo "  Profile:  development (with Metro bundler)"
echo "  Build ID: $BUILD_ID"
echo "  Status:   IN PROGRESS"
echo ""
echo "🔗 Track build: https://expo.dev/accounts/waleed17/projects/sukoon-app/builds/$BUILD_ID"
echo ""
echo "⏳ Waiting for build to complete (typical 3-5 minutes)..."
echo ""

# Poll for build completion
while true; do
  STATUS=$(eas build:view "$BUILD_ID" 2>&1 | grep -A5 "^Platform" | grep "Status" | awk '{print $NF}')
  
  if [ "$STATUS" = "FINISHED" ]; then
    echo "✅ Build completed successfully!"
    break
  elif [ "$STATUS" = "errored" ]; then
    echo "❌ Build failed! Check logs:"
    echo "   https://expo.dev/accounts/waleed17/projects/sukoon-app/builds/$BUILD_ID"
    exit 1
  else
    echo "⏳ Status: $STATUS"
    sleep 10
  fi
done

# Download APK
echo ""
echo "📥 Downloading APK..."
eas build:download "$BUILD_ID" --output="./Sukoon-debug.apk"

echo "✅ APK ready: ./Sukoon-debug.apk"
echo ""
echo "📱 Install on device:"
echo "   adb install -r ./Sukoon-debug.apk"
echo ""
