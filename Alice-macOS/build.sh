#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_NAME="Alice"
APP_BUNDLE="${ROOT_DIR}/${APP_NAME}.app"

echo "==> Building ${APP_NAME} Native macOS App..."

# Build directory
BUILD_DIR="${SCRIPT_DIR}/build"
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# 1. Compile Swift sources
SOURCES=(
  "${SCRIPT_DIR}/Sources/TranslationService.swift"
  "${SCRIPT_DIR}/Sources/HarnessService.swift"
  "${SCRIPT_DIR}/Sources/PreferencesWindowController.swift"
  "${SCRIPT_DIR}/Sources/WebViewController.swift"
  "${SCRIPT_DIR}/Sources/MainWindowController.swift"
  "${SCRIPT_DIR}/Sources/AppDelegate.swift"
  "${SCRIPT_DIR}/Sources/main.swift"
)

echo "==> Compiling Swift sources with swiftc..."
swiftc -O \
  -target arm64-apple-macos12.0 \
  -framework Cocoa \
  -framework WebKit \
  -o "${BUILD_DIR}/${APP_NAME}" \
  "${SOURCES[@]}"

# 2. Assemble App Bundle
echo "==> Assembling ${APP_NAME}.app bundle..."
rm -rf "${APP_BUNDLE}"
mkdir -p "${APP_BUNDLE}/Contents/MacOS"
mkdir -p "${APP_BUNDLE}/Contents/Resources"

# Copy binary
cp "${BUILD_DIR}/${APP_NAME}" "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}"
chmod +x "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}"

# Copy Info.plist
cp "${SCRIPT_DIR}/Resources/Info.plist" "${APP_BUNDLE}/Contents/Info.plist"

# Copy AppIcon.icns
cp "${SCRIPT_DIR}/Resources/AppIcon.icns" "${APP_BUNDLE}/Contents/Resources/AppIcon.icns"

# Copy JavaScript files
cp "${SCRIPT_DIR}/Resources/bridge.js" "${APP_BUNDLE}/Contents/Resources/bridge.js"
cp "${SCRIPT_DIR}/Resources/content.js" "${APP_BUNDLE}/Contents/Resources/content.js"

# 3. Code sign ad-hoc
echo "==> Codesigning ${APP_NAME}.app..."
codesign --force --deep --sign - "${APP_BUNDLE}"

echo "==> Build successful: ${APP_BUNDLE}"
echo "    You can launch it with: open \"${APP_BUNDLE}\""
