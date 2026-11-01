#!/bin/bash
# Собирает macOS-версию и устанавливает её в /Applications.
# Личные настройки (bundle ID, команда) берутся из local.env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT/xcode/NoShortsThere/NoShortsThere.xcodeproj"
BUILD="$ROOT/xcode/build"
APP="$BUILD/Build/Products/Release/NoShortsThere.app"

if [[ ! -f "$ROOT/local.env" ]]; then
  echo "Нет local.env — скопируй local.env.example в local.env и заполни." >&2
  exit 1
fi
source "$ROOT/local.env"

SIGNING=(DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM:-}")
if [[ -n "${DEVELOPMENT_TEAM:-}" ]]; then
  SIGNING+=(CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates)
else
  SIGNING+=(CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=-)
fi

xcodebuild -project "$PROJECT" -scheme "NoShortsThere (macOS)" -configuration Release \
  -derivedDataPath "$BUILD" BUNDLE_ID_PREFIX="$BUNDLE_ID_PREFIX" "${SIGNING[@]}" \
  build -quiet

# Копии приложения в папке сборки Safari показал бы вторым расширением —
# снимаем их с регистрации и удаляем после установки.
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
pkill -x NoShortsThere 2>/dev/null || true
rm -rf /Applications/NoShortsThere.app
ditto "$APP" /Applications/NoShortsThere.app
"$LSREGISTER" -u "$APP" 2>/dev/null || true
rm -rf "$BUILD"

open /Applications/NoShortsThere.app
echo "Готово: /Applications/NoShortsThere.app"
