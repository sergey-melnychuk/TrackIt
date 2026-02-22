#!/bin/sh
set -eu

MODE="${1:-bundle}"
ANDROID_DIR="android"
APP_DIR="$ANDROID_DIR/app"
KEYSTORE_DEST="$APP_DIR/release-keystore.jks"
KEY_PROPS="$ANDROID_DIR/key.properties"
LOCAL_PROPS="$ANDROID_DIR/local.properties"
SDK_PATH="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"

prompt_secret() {
  PROMPT_LABEL="$1"
  stty -echo
  printf "%s" "$PROMPT_LABEL" >&2
  IFS= read -r SECRET_VALUE
  stty echo
  printf "\n" >&2
  printf "%s" "$SECRET_VALUE"
}

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

if [ -z "${ANDROID_KEYSTORE_PATH:-}" ] || [ -z "${ANDROID_KEY_ALIAS:-}" ]; then
  echo "Missing required signing settings."
  echo "Required: ANDROID_KEYSTORE_PATH, ANDROID_KEY_ALIAS"
  echo "Optional (if you do not want prompts): ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_PASSWORD"
  exit 1
fi

if [ ! -f "$ANDROID_KEYSTORE_PATH" ]; then
  echo "Keystore file not found at: $ANDROID_KEYSTORE_PATH"
  exit 1
fi

KEYSTORE_PASSWORD="${ANDROID_KEYSTORE_PASSWORD:-}"
KEY_PASSWORD="${ANDROID_KEY_PASSWORD:-}"

if [ -z "$KEYSTORE_PASSWORD" ]; then
  KEYSTORE_PASSWORD="$(prompt_secret "Keystore password: ")"
fi

if [ -z "$KEY_PASSWORD" ]; then
  KEY_PASSWORD="$(prompt_secret "Key password: ")"
fi

mkdir -p "$APP_DIR"
cp "$ANDROID_KEYSTORE_PATH" "$KEYSTORE_DEST"

cat > "$KEY_PROPS" <<EOF
storeFile=app/release-keystore.jks
storePassword=$KEYSTORE_PASSWORD
keyAlias=$ANDROID_KEY_ALIAS
keyPassword=$KEY_PASSWORD
EOF

if [ "$MODE" = "apk" ]; then
  (cd "$ANDROID_DIR" && ./gradlew assembleRelease)
  echo "Built APK: $ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
else
  (cd "$ANDROID_DIR" && ./gradlew bundleRelease)
  echo "Built AAB: $ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
fi
