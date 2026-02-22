#!/bin/sh
set -eu

ANDROID_DIR="android"
LOCAL_PROPS="$ANDROID_DIR/local.properties"
SDK_PATH="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"

if [ ! -d "$ANDROID_DIR" ]; then
  echo "android/ directory not found. Run expo prebuild first."
  exit 1
fi

if [ ! -d "$SDK_PATH" ]; then
  echo "Android SDK not found at: $SDK_PATH"
  echo "Set ANDROID_HOME or ANDROID_SDK_ROOT to your Android SDK directory."
  exit 1
fi

cat > "$LOCAL_PROPS" <<EOF
sdk.dir=$SDK_PATH
EOF

(cd "$ANDROID_DIR" && ./gradlew assembleDebug)
echo "Built APK: $ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
