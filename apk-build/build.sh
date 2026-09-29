#!/usr/bin/env bash
# 梅花易数·全息占 APK 构建脚本（无 Gradle，直接命令链）
# 用法: ./build.sh   -> 产物 meihua-yishu-app-android14.apk
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/app/src/main"
BUILD="$ROOT/build"
# 构建工具链根目录：android-14/、android-34/android.jar、jdk/bin 均位于其下
TOOLS="${ANDROID_TOOLS:?"请设置 ANDROID_TOOLS（指向含 android-14/ android-34/ jdk/ 的构建工具根目录）"}"

BT="$TOOLS/android-14"
PLATFORM="$TOOLS/android-34/android.jar"
JDK_BIN="$TOOLS/jdk/bin"

AAPT2="$BT/aapt2"
D8="$BT/d8"
APKSIGNER="$BT/apksigner"
ZIPALIGN="$BT/zipalign"
JAVA="$JDK_BIN/java"
JAVAC="$JDK_BIN/javac"
KEYTOOL="$JDK_BIN/keytool"
ECJ="$ROOT/ecj.jar"

# ---- 签名配置（自用调试签名；正式分发请更换密钥）----
KS="$ROOT/keys/meihua-release.jks"
KS_ALIAS="meihua"
KS_PASS="${MEIHUA_KS_PASS:?"请设置 MEIHUA_KS_PASS（签名口令；密钥不存在时将用它自动生成）"}"
KS_STORE="$KS_PASS"

echo "==> 清理构建目录"
rm -rf "$BUILD" && mkdir -p "$BUILD/gen" "$BUILD/classes" "$BUILD/dex" "$BUILD/apk"

echo "==> 1/6 aapt2 compile 资源"
"$AAPT2" compile --dir "$APP/res" -o "$BUILD/compiled-res.zip"

echo "==> 2/6 aapt2 link 生成 base.apk（含 assets）"
"$AAPT2" link \
  -o "$BUILD/apk/base.apk" \
  -I "$PLATFORM" \
  --manifest "$APP/AndroidManifest.xml" \
  -A "$APP/assets" \
  --java "$BUILD/gen" \
  --min-sdk-version 21 \
  --target-sdk-version 34 \
  --auto-add-overlay \
  "$BUILD/compiled-res.zip"

echo "==> 3/6 javac 编译"
"$JAVAC" -source 8 -target 8 -encoding UTF-8 \
  -classpath "$PLATFORM" \
  -d "$BUILD/classes" \
  "$APP/java/com/meihuayishu/app/MainActivity.java" \
  "$BUILD/gen/com/meihuayishu/app/R.java"

echo "==> 4/6 d8 转 dex"
"$D8" --release --min-api 21 --lib "$PLATFORM" --output "$BUILD/dex" \
  "$BUILD/classes/com/meihuayishu/app/"*.class

echo "==> 5/6 注入 classes.dex + zipalign"
python3 - "$BUILD/apk/base.apk" "$BUILD/dex/classes.dex" <<'PY'
import sys, zipfile, shutil
apk, dex = sys.argv[1], sys.argv[2]
tmp = apk + ".tmp"
with zipfile.ZipFile(apk, "r") as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        zout.writestr(item, zin.read(item.filename))
    zout.write(dex, "classes.dex")
shutil.move(tmp, apk)
print("classes.dex 已注入")
PY
"$ZIPALIGN" -f 4 "$BUILD/apk/base.apk" "$BUILD/apk/aligned.apk"

echo "==> 6/6 签名"
mkdir -p "$ROOT/keys"
if [ ! -f "$KS" ]; then
  "$KEYTOOL" -genkeypair -keystore "$KS" -alias "$KS_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_STORE" -keypass "$KS_PASS" \
    -dname "CN=MeihuaYishu App, OU=Personal, O=Personal, L=Beijing, C=CN"
fi
"$APKSIGNER" sign --ks "$KS" --ks-key-alias "$KS_ALIAS" \
  --ks-pass "pass:$KS_STORE" --key-pass "pass:$KS_PASS" \
  --out "$ROOT/meihua-yishu-app-android14.apk" "$BUILD/apk/aligned.apk"

echo "==> 完成: $ROOT/meihua-yishu-app-android14.apk"
"$APKSIGNER" verify --print-certs "$ROOT/meihua-yishu-app-android14.apk" | head -8
ls -la "$ROOT/meihua-yishu-app-android14.apk"