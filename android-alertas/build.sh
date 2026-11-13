#!/usr/bin/env bash
# No Gradle or third-party Android runtime dependency is required.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
: "${ANDROID_JAR:?Informe ANDROID_JAR (platforms/android-35/android.jar)}"
: "${BUILD_TOOLS:?Informe BUILD_TOOLS (build-tools/35.0.0)}"
: "${KEYSTORE:?Informe KEYSTORE fora do repositório}"
: "${KEYSTORE_PASSWORD_FILE:?Informe KEYSTORE_PASSWORD_FILE fora do repositório}"
OUTPUT_APK="${OUTPUT_APK:-$ROOT/build/AurenBot-Alertas-Android-v1.0.0.apk}"
BUILD="$ROOT/build"
rm -rf "$BUILD/classes" "$BUILD/generated" "$BUILD/dex"
mkdir -p "$BUILD/classes" "$BUILD/generated" "$BUILD/dex" "$(dirname -- "$OUTPUT_APK")"
"$BUILD_TOOLS/aapt2" compile --dir "$ROOT/res" -o "$BUILD/resources.zip"
"$BUILD_TOOLS/aapt2" link -o "$BUILD/resources.apk" --manifest "$ROOT/AndroidManifest.xml" -I "$ANDROID_JAR" --java "$BUILD/generated" "$BUILD/resources.zip"
mapfile -d '' SOURCES < <(find "$ROOT/src" "$BUILD/generated" -name '*.java' -print0)
BOOTCLASSPATH="$ANDROID_JAR:$BUILD_TOOLS/core-lambda-stubs.jar"
if [[ -n "${ECJ_JAR:-}" ]]; then
 java -jar "$ECJ_JAR" -source 8 -target 8 -nowarn -bootclasspath "$BOOTCLASSPATH" -d "$BUILD/classes" "${SOURCES[@]}"
else
 javac -source 8 -target 8 -bootclasspath "$BOOTCLASSPATH" -encoding UTF-8 -d "$BUILD/classes" "${SOURCES[@]}"
fi
mapfile -d '' CLASSES < <(find "$BUILD/classes" -name '*.class' -print0)
"$BUILD_TOOLS/d8" --min-api 26 --lib "$ANDROID_JAR" --output "$BUILD/dex" "${CLASSES[@]}"
cp "$BUILD/resources.apk" "$BUILD/unsigned.apk"
(cd "$BUILD/dex"; for dex in *.dex; do "$BUILD_TOOLS/aapt" add "$BUILD/unsigned.apk" "$dex" >/dev/null; done)
"$BUILD_TOOLS/zipalign" -f -p 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"
"$BUILD_TOOLS/apksigner" sign --ks "$KEYSTORE" --ks-key-alias aurenbot --ks-pass "file:$KEYSTORE_PASSWORD_FILE" --out "$OUTPUT_APK" "$BUILD/aligned.apk"
"$BUILD_TOOLS/apksigner" verify --verbose "$OUTPUT_APK"
"$BUILD_TOOLS/zipalign" -c -p 4 "$OUTPUT_APK"
printf 'APK: %s\n' "$OUTPUT_APK"
