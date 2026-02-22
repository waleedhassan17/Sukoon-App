#!/bin/bash
set -e

export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/home/muhammad-waleed-hassan/Android/Sdk

cd /home/muhammad-waleed-hassan/Sukoon/Sukoon-App/android

echo "🚀 Building Sukoon APK..."
echo "Working directory: $(pwd)"
echo "JAVA_HOME: $JAVA_HOME"
echo "ANDROID_HOME: $ANDROID_HOME"

./gradlew assembleRelease

echo ""
echo "✅ Build complete!"
echo ""

APK_PATH=$(find /home/muhammad-waleed-hassan/Sukoon/Sukoon-App/android/app/build/outputs -name "*.apk" -type f 2>/dev/null | head -1)
if [ -n "$APK_PATH" ]; then
    echo "📱 APK Location: $APK_PATH"
    echo "📦 APK Size: $(du -h "$APK_PATH" | cut -f1)"
    
    # Copy to project root for easy access
    cp "$APK_PATH" /home/muhammad-waleed-hassan/Sukoon/Sukoon-App/sukoon-release.apk
    echo ""
    echo "📋 Copied to: /home/muhammad-waleed-hassan/Sukoon/Sukoon-App/sukoon-release.apk"
else
    echo "❌ APK not found in expected location"
    find /home/muhammad-waleed-hassan/Sukoon/Sukoon-App/android -name "*.apk" -type f 2>/dev/null
fi
