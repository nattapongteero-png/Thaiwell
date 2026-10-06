#!/bin/sh
# Build the ThaiWell AI app (Release — JS bundled, no Metro needed) and install + launch it on a connected iPhone/iPad.
#   npm run ios:device                         → first paired iPhone
#   DEVICE=<CoreDevice id> npm run ios:device  → a specific device (xcrun devicectl list devices)
# Signs with your own Apple team and a bundle id that is free under it; the overrides are applied to a copy of the
# project file for the build only and never committed (the repo keeps the team/bundle id of its owner).
#   TEAM=XXXXXXXXXX BUNDLE_ID=com.example.thaiwell npm run ios:device
set -e
cd "$(dirname "$0")/.."
export NODE_OPTIONS="--no-experimental-strip-types"
TEAM=${TEAM:-FFFGJANVWN}
BUNDLE_ID=${BUNDLE_ID:-com.oommie.thaiwell}
DEVICE=${DEVICE:-$(xcrun devicectl list devices 2>/dev/null | awk '/iPhone/ && /available/ {for (i=1;i<=NF;i++) if ($i ~ /^[0-9A-F-]{36}$/) {print $i; exit}}')}
[ -n "$DEVICE" ] || { echo "ไม่พบ iPhone ที่เชื่อมต่อ (ต่อสายหรือ Wi-Fi เดียวกัน และเปิด Developer Mode)"; exit 1; }
[ -d ios/Pods ] || (cd ios && pod install)
PBX=ios/ThaiWellAI.xcodeproj/project.pbxproj
cp "$PBX" "$PBX.orig"
trap 'mv "$PBX.orig" "$PBX"' EXIT
sed -i '' -e "s/DEVELOPMENT_TEAM = [A-Z0-9]*;/DEVELOPMENT_TEAM = $TEAM;/g" -e "s/PRODUCT_BUNDLE_IDENTIFIER = com\.healthflow\.thaiwell;/PRODUCT_BUNDLE_IDENTIFIER = $BUNDLE_ID;/g" "$PBX"
# generic iOS destination: builds for any registered device, so a phone paired over Wi-Fi (not visible to xcodebuild) still works
xcodebuild -workspace ios/ThaiWellAI.xcworkspace -scheme ThaiWellAI -configuration Release \
  -destination "generic/platform=iOS" -derivedDataPath ios/build -allowProvisioningUpdates -quiet build
xcrun devicectl device install app --device "$DEVICE" ios/build/Build/Products/Release-iphoneos/ThaiWellAI.app
xcrun devicectl device process launch --device "$DEVICE" "$BUNDLE_ID"
echo "ติดตั้ง ThaiWell AI บนมือถือแล้ว"
