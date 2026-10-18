#!/usr/bin/env bash
# Regression check for release signing (audit C-1): a release build never silently uses the Android debug key.
#   1. a release build without the upload key stops;
#   2. a Play bundle refuses -PallowDebugSignedRelease;
#   3. a Play bundle "signed" with the debug keystore is caught after the build and deleted;
#   4. a Play bundle signed with a real (throwaway) upload key builds and passes the check.
# Uses a throwaway keystore in a temp folder — never the real upload key. Run from apps/mobile/android.
set -uo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fail() { echo "✗ $1"; exit 1; }

./gradlew assembleRelease --dry-run -q >"$tmp/1" 2>&1 && fail "release build without upload key did not stop"
grep -q "Release builds need the upload key" "$tmp/1" || fail "missing explanation when the upload key is absent"
echo "✓ release build without the upload key stops"

./gradlew bundleRelease -PallowDebugSignedRelease --dry-run -q >"$tmp/2" 2>&1 && fail "bundle accepted the debug opt-in"
grep -q "never signed with the debug key" "$tmp/2" || fail "missing explanation for the debug opt-in"
echo "✓ Play bundle refuses the debug-key opt-in"

./gradlew bundleRelease -PLOVIRA_UPLOAD_STORE_FILE="$PWD/app/debug.keystore" -PLOVIRA_UPLOAD_STORE_PASSWORD=android \
  -PLOVIRA_UPLOAD_KEY_ALIAS=androiddebugkey -PLOVIRA_UPLOAD_KEY_PASSWORD=android >"$tmp/3" 2>&1 && fail "debug-signed bundle was accepted"
grep -q "signed with the Android debug key" "$tmp/3" || fail "debug-signed bundle not detected"
[ ! -f app/build/outputs/bundle/release/app-release.aab ] || fail "debug-signed bundle was not deleted"
echo "✓ a bundle signed with the debug keystore is caught and deleted"

keytool -genkeypair -keystore "$tmp/upload.jks" -storepass throwaway123 -keypass throwaway123 -alias test-upload \
  -keyalg RSA -keysize 2048 -validity 1 -dname "CN=Signing Check" >/dev/null 2>&1 || fail "could not create the test keystore"
./gradlew bundleRelease -PLOVIRA_UPLOAD_STORE_FILE="$tmp/upload.jks" -PLOVIRA_UPLOAD_STORE_PASSWORD=throwaway123 \
  -PLOVIRA_UPLOAD_KEY_ALIAS=test-upload -PLOVIRA_UPLOAD_KEY_PASSWORD=throwaway123 >"$tmp/4" 2>&1 || { tail -20 "$tmp/4"; fail "bundle with an upload key failed"; }
keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab | grep -q "CN=Signing Check" || fail "bundle not signed with the upload key"
echo "✓ a bundle signed with an upload key builds and is verified"
