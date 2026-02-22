#!/bin/bash

#========================================
# Sukoon App - Release APK Build Script
#========================================
# Builds and downloads a release APK from EAS
# Usage: ./build-release.sh

set -e

cd "$(dirname "$0")"

echo "🚀 Sukoon - Release Build Script"
echo "=================================="
echo ""

# Check version matches
read -p "Enter new version (e.g., 1.0.1): " NEW_VERSION

# Check app.json
CURRENT_VERSION=$(grep '"version"' app.json | head -1 | grep -oP '"\K[^"]+')
echo ""
echo "Current version: $CURRENT_VERSION"
echo "New version: $NEW_VERSION"
echo ""

read -p "Update app.json and proceed? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
  echo "Cancelled."
  exit 1
fi

# Update version in app.json
echo ""
echo "📝 Updating app.json..."

# Note: This is a simplified version updater
# For production, use a proper version bump tool
echo "⚠️  Manual step required:"
echo ""
echo "1. Edit app.json and update:"
echo '   - "version": "'$NEW_VERSION'"'
echo '   - "android": { "versionCode": <INCREMENTED_NUMBER> }'
echo ""
echo "2. Then run:"
echo "   eas build --platform android --profile preview --no-wait"
echo ""

# Check if logged into EAS
echo "✓ Checking EAS login..."
if ! eas whoami > /dev/null 2>&1; then
  echo "❌ Not logged into EAS. Run: eas login"
  exit 1
fi

echo ""
echo "📤 Submitting release build to EAS..."
BUILD_OUTPUT=$(eas build --platform android --profile preview --no-wait 2>&1)
BUILD_ID=$(echo "$BUILD_OUTPUT" | grep -oP 'builds/\K[a-f0-9-]+' | head -1)

if [ -z "$BUILD_ID" ]; then
  echo "❌ Failed to extract build ID"
  exit 1
fi

echo "✅ Build submitted!"
echo ""
echo "📊 Build Details:"
echo "  Platform: Android"
echo "  Profile:  preview (production-optimized)"
echo "  Version:  $NEW_VERSION"
echo "  Build ID: $BUILD_ID"
echo "  Status:   IN PROGRESS"
echo ""
echo "🔗 Track build: https://expo.dev/accounts/waleed17/projects/sukoon-app/builds/$BUILD_ID"
echo ""
echo "⏳ Waiting for build to complete (typical 5-8 minutes)..."
echo ""

# Poll for build completion
WAIT_COUNT=0
while true; do
  STATUS=$(eas build:view "$BUILD_ID" 2>&1 | grep -A5 "^Platform" | grep "Status" | awk '{print $NF}')
  
  if [ "$STATUS" = "finished" ]; then
    echo "✅ Build completed successfully!"
    break
  elif [ "$STATUS" = "errored" ]; then
    echo "❌ Build failed!"
    echo "   Logs: https://expo.dev/accounts/waleed17/projects/sukoon-app/builds/$BUILD_ID"
    exit 1
  fi
  
  WAIT_COUNT=$((WAIT_COUNT + 1))
  if [ $WAIT_COUNT -gt 120 ]; then
    echo "⏱️  Build taking longer than expected. Check manually:"
    echo "   https://expo.dev/accounts/waleed17/projects/sukoon-app/builds/$BUILD_ID"
    exit 1
  fi
  
  echo "⏳ Still building... (${WAIT_COUNT}*10s elapsed)"
  sleep 10
done

# Download APK
echo ""
echo "📥 Downloading APK..."
eas build:download "$BUILD_ID" --output="./Sukoon-v${NEW_VERSION}.apk"

echo ""
echo "✅ Release APK ready!"
echo "   📦 File: ./Sukoon-v${NEW_VERSION}.apk"
echo ""
echo "📱 Install on device:"
echo "   adb install -r ./Sukoon-v${NEW_VERSION}.apk"
echo ""
echo "🚀 Next steps:"
echo "   1. Test thoroughly on device"
echo "   2. Share with testers or upload to Play Store"
echo "   3. Tag release in git:"
echo "      git tag -a v${NEW_VERSION} -m 'Release v${NEW_VERSION}'"
echo "      git push origin v${NEW_VERSION}"
echo ""
