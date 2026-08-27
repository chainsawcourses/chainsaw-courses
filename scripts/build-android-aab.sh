#!/usr/bin/env bash

# Build and export the signed Android App Bundle without relying on the
# workspace's default GraalVM or a preconfigured Android SDK.

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$ROOT_DIR/artifacts/chainsaw-training"
ANDROID_DIR="$APP_DIR/android"
APP_BUILD_FILE="$ANDROID_DIR/app/build.gradle"
SIGNING_INFO_FILE="$ROOT_DIR/.local/android-signing/signing-key-info.txt"

CACHE_DIR="${ANDROID_BUILD_CACHE:-$ROOT_DIR/.cache/android-build}"
JDK_DIR="$CACHE_DIR/jdk-21"
DEFAULT_SDK_DIR="$CACHE_DIR/android-sdk"
GRADLE_CACHE_DIR="$CACHE_DIR/gradle"
JDK_DOWNLOAD_URL="${ANDROID_JDK_DOWNLOAD_URL:-https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse}"
CMDLINE_TOOLS_DOWNLOAD_URL="${ANDROID_CMDLINE_TOOLS_DOWNLOAD_URL:-https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip}"
ANDROID_API="android-36"
ANDROID_BUILD_TOOLS="36.0.0"
EXPECTED_SIGNING_SHA1="4F:5C:4C:21:43:74:90:B4:BF:31:55:B9:88:EB:32:69:11:EC:58:05"

TEMP_DIR=""

cleanup() {
    if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
        rm -rf -- "$TEMP_DIR"
    fi
}
trap cleanup EXIT

die() {
    echo "Android release build failed: $*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "required command '$1' was not found"
}

is_standard_java_21() {
    local candidate="$1"
    local version_line

    [[ -x "$candidate/bin/java" && -x "$candidate/bin/javac" ]] || return 1
    version_line="$("$candidate/bin/java" -version 2>&1 | sed -n '1p')" || return 1
    [[ "$version_line" != *GraalVM* ]] || return 1
    [[ "$version_line" =~ \"21([._]) ]] || [[ "$version_line" =~ [[:space:]]21([._]|$) ]]
}

find_java_21() {
    local candidate
    local candidates=()

    if [[ -n "${JAVA_HOME:-}" ]]; then
        candidates+=("$JAVA_HOME")
    fi

    # Keep the search shallow and targeted; /nix/store contains many unrelated
    # packages and a recursive search there is unnecessarily expensive.
    candidates+=(
        "$JDK_DIR"
        /usr/lib/jvm/*21*
        /opt/java/*21*
        /nix/store/*jdk21*
        /nix/store/*jdk-21*
        /nix/store/*temurin*21*
        /nix/store/*openjdk*21*
    )

    for candidate in "${candidates[@]}"; do
        if [[ -d "$candidate" ]] && is_standard_java_21 "$candidate"; then
            printf '%s\n' "$candidate"
            return 0
        fi
    done

    return 1
}

download_java_21() {
    local archive extracted

    require_command curl
    require_command tar
    mkdir -p -- "$CACHE_DIR"
    TEMP_DIR="$(mktemp -d "$CACHE_DIR/.tmp.XXXXXX")"
    archive="$TEMP_DIR/jdk-21.tar.gz"

    echo "Downloading standard Java 21 into the workspace cache..."
    curl --fail --location --retry 3 --retry-delay 2 --silent --show-error \
        "$JDK_DOWNLOAD_URL" --output "$archive"
    tar --extract --gzip --file "$archive" --directory "$TEMP_DIR"

    extracted="$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'jdk*' -print -quit)"
    [[ -n "$extracted" ]] || die "Java 21 archive did not contain a JDK directory"

    rm -rf -- "$JDK_DIR"
    mv -- "$extracted" "$JDK_DIR"
    is_standard_java_21 "$JDK_DIR" || die "downloaded Java runtime is not a standard JDK 21"
}

select_sdk_root() {
    if [[ -n "${ANDROID_SDK_ROOT:-}" ]]; then
        printf '%s\n' "$ANDROID_SDK_ROOT"
        return
    fi
    if [[ -n "${ANDROID_HOME:-}" ]]; then
        printf '%s\n' "$ANDROID_HOME"
        return
    fi

    local candidate
    for candidate in "$DEFAULT_SDK_DIR" "$HOME/Android/Sdk" "$HOME/.android/sdk" /opt/android-sdk /usr/lib/android-sdk; do
        if [[ -d "$candidate" ]]; then
            printf '%s\n' "$candidate"
            return
        fi
    done
    printf '%s\n' "$DEFAULT_SDK_DIR"
}

find_sdkmanager() {
    local sdk_root="$1"

    if [[ -x "$sdk_root/cmdline-tools/latest/bin/sdkmanager" ]]; then
        printf '%s\n' "$sdk_root/cmdline-tools/latest/bin/sdkmanager"
        return 0
    fi
    if [[ -x "$sdk_root/cmdline-tools/bin/sdkmanager" ]]; then
        printf '%s\n' "$sdk_root/cmdline-tools/bin/sdkmanager"
        return 0
    fi
    if command -v sdkmanager >/dev/null 2>&1; then
        command -v sdkmanager
        return 0
    fi
    return 1
}

download_command_line_tools() {
    local sdk_root="$1"
    local archive extracted tools_dir

    require_command curl
    require_command unzip
    mkdir -p -- "$CACHE_DIR" "$sdk_root/cmdline-tools"
    TEMP_DIR="${TEMP_DIR:-$(mktemp -d "$CACHE_DIR/.tmp.XXXXXX")}"
    archive="$TEMP_DIR/android-command-line-tools.zip"
    tools_dir="$TEMP_DIR/sdk-tools"

    echo "Downloading Android command-line tools into the workspace cache..."
    curl --fail --location --retry 3 --retry-delay 2 --silent --show-error \
        "$CMDLINE_TOOLS_DOWNLOAD_URL" --output "$archive"
    mkdir -p -- "$tools_dir"
    unzip -q "$archive" -d "$tools_dir"

    if [[ -d "$tools_dir/cmdline-tools" ]]; then
        extracted="$tools_dir/cmdline-tools"
    else
        extracted="$(find "$tools_dir" -mindepth 1 -maxdepth 1 -type d -print -quit)"
    fi
    [[ -n "$extracted" && -x "$extracted/bin/sdkmanager" ]] \
        || die "Android command-line tools archive did not contain sdkmanager"

    rm -rf -- "$sdk_root/cmdline-tools/latest"
    mv -- "$extracted" "$sdk_root/cmdline-tools/latest"
}

install_android_sdk() {
    local sdk_root="$1"
    local sdkmanager="$2"

    mkdir -p -- "$sdk_root"

    # sdkmanager asks for each license interactively. The answers are not
    # credentials and are deliberately kept out of the build log.
    set +o pipefail
    yes | "$sdkmanager" --sdk_root="$sdk_root" --licenses >/dev/null
    set -o pipefail
    "$sdkmanager" --sdk_root="$sdk_root" \
        "platform-tools" \
        "platforms;$ANDROID_API" \
        "build-tools;$ANDROID_BUILD_TOOLS" >/dev/null

    [[ -d "$sdk_root/platforms/$ANDROID_API" ]] \
        || die "Android SDK platform $ANDROID_API was not installed"
    [[ -x "$sdk_root/build-tools/$ANDROID_BUILD_TOOLS/aapt2" ]] \
        || die "Android build tools $ANDROID_BUILD_TOOLS were not installed"
}

validate_release_manifest() {
    local manifest_file="$1"
    local expected_package="$2"
    local expected_version_code="$3"
    local expected_version_name="$4"

    grep -Fq "package=\"$expected_package\"" "$manifest_file" \
        || die "bundle manifest package did not match $expected_package"
    grep -Fq "android:versionCode=\"$expected_version_code\"" "$manifest_file" \
        || die "bundle manifest version code did not match $expected_version_code"
    grep -Fq "android:versionName=\"$expected_version_name\"" "$manifest_file" \
        || die "bundle manifest version name did not match $expected_version_name"
}

validate_release_certificate() {
    local bundle_file="$1"
    local actual_sha1

    actual_sha1="$(
        keytool -printcert -jarfile "$bundle_file" 2>/dev/null \
            | sed -n 's/^[[:space:]]*SHA1:[[:space:]]*//p' \
            | head -n 1
    )"
    [[ -n "$actual_sha1" ]] || die "could not read the signed bundle certificate"
    [[ "${actual_sha1^^}" == "${EXPECTED_SIGNING_SHA1^^}" ]] \
        || die "bundle certificate does not match the Google Play upload certificate"
}

require_command pnpm
require_command node
require_command sha256sum
require_command unzip
require_command keytool

[[ -d "$ANDROID_DIR" && -f "$APP_BUILD_FILE" ]] \
    || die "Capacitor Android project was not found at $ANDROID_DIR"
[[ -f "$SIGNING_INFO_FILE" ]] \
    || die "local signing setup is missing at .local/android-signing/signing-key-info.txt"

for required_signing_field in \
    "Key store file" \
    "Key store password" \
    "Key alias" \
    "Key password"; do
    grep -q "^${required_signing_field}:" "$SIGNING_INFO_FILE" \
        || die "local signing setup is missing a required field"
done

JAVA_HOME_DIR="$(find_java_21 || true)"
if [[ -z "$JAVA_HOME_DIR" ]]; then
    download_java_21
    JAVA_HOME_DIR="$JDK_DIR"
fi
export JAVA_HOME="$JAVA_HOME_DIR"
export PATH="$JAVA_HOME/bin:$PATH"
echo "Using standard Java 21 from $JAVA_HOME"

SDK_ROOT="$(select_sdk_root)"
mkdir -p -- "$SDK_ROOT"
SDKMANAGER="$(find_sdkmanager "$SDK_ROOT" || true)"
if [[ -z "$SDKMANAGER" ]]; then
    download_command_line_tools "$SDK_ROOT"
    SDKMANAGER="$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"
fi
install_android_sdk "$SDK_ROOT" "$SDKMANAGER"
export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$GRADLE_CACHE_DIR}"

echo "Building the web bundle and syncing Capacitor Android assets..."
# The Vite configuration enforces these for preview workflows. They do not
# affect a static release build, but provide valid defaults when this command
# runs outside an artifact workflow.
export PORT="${PORT:-5173}"
export BASE_PATH="${BASE_PATH:-/}"
pnpm --filter @workspace/chainsaw-training run build
pnpm --filter @workspace/chainsaw-training exec cap sync android

echo "Building the signed release App Bundle..."
(
    cd "$ANDROID_DIR"
    ./gradlew --no-daemon bundleRelease
)

SOURCE_AAB="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
BUNDLE_MANIFEST_FILE="$ANDROID_DIR/app/build/intermediates/bundle_manifest/release/processApplicationManifestReleaseForBundle/AndroidManifest.xml"
[[ -s "$SOURCE_AAB" ]] || die "Gradle did not produce a release AAB"
[[ -s "$BUNDLE_MANIFEST_FILE" ]] || die "Gradle did not produce a release bundle manifest"

APPLICATION_ID="$(sed -nE 's/^[[:space:]]*applicationId[[:space:]]+"([^"]+)".*$/\1/p' "$APP_BUILD_FILE" | head -n 1)"
VERSION_CODE="$(sed -nE 's/^[[:space:]]*versionCode[[:space:]]+([0-9]+).*$/\1/p' "$APP_BUILD_FILE" | head -n 1)"
VERSION_NAME="$(sed -nE 's/^[[:space:]]*versionName[[:space:]]+"([^"]+)".*$/\1/p' "$APP_BUILD_FILE" | head -n 1)"
[[ -n "$APPLICATION_ID" && -n "$VERSION_CODE" && -n "$VERSION_NAME" ]] \
    || die "could not read application package and version metadata"

validate_release_manifest \
    "$BUNDLE_MANIFEST_FILE" \
    "$APPLICATION_ID" \
    "$VERSION_CODE" \
    "$VERSION_NAME"
validate_release_certificate "$SOURCE_AAB"
unzip -tqq "$SOURCE_AAB"

EXPORT_DIR="$ROOT_DIR/exports"
EXPORT_AAB="$EXPORT_DIR/Chainsaw_Courses_Android_${APPLICATION_ID}_v${VERSION_NAME}_code${VERSION_CODE}.aab"
EXPORT_CHECKSUM="$EXPORT_AAB.sha256"
mkdir -p -- "$EXPORT_DIR"
cp -- "$SOURCE_AAB" "$EXPORT_AAB"
CHECKSUM="$(sha256sum "$EXPORT_AAB" | awk '{print $1}')"
printf '%s  %s\n' "$CHECKSUM" "$(basename "$EXPORT_AAB")" > "$EXPORT_CHECKSUM"

(
    cd "$EXPORT_DIR"
    sha256sum --check "$(basename "$EXPORT_CHECKSUM")" >/dev/null
)
COPIED_CHECKSUM="$(sha256sum "$EXPORT_AAB" | awk '{print $1}')"
[[ "$CHECKSUM" == "$COPIED_CHECKSUM" ]] || die "export checksum changed while copying"

echo "Android release export verified:"
echo "  package:    $APPLICATION_ID"
echo "  version:    $VERSION_NAME"
echo "  versionCode: $VERSION_CODE"
echo "  AAB:        $EXPORT_AAB"
echo "  SHA-256:    $CHECKSUM"