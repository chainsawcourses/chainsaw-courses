#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

die() {
    echo "Mobile handoff verification failed: $*" >&2
    exit 1
}

usage() {
    cat <<'EOF'
Usage:
  bash scripts/mobile-handoff-checksum.sh create <handoff-path>
  bash scripts/mobile-handoff-checksum.sh verify <handoff-path>
  bash scripts/mobile-handoff-checksum.sh audit

The handoff path must be a file or directory directly under exports/.
Audit discovers every top-level .aab, .zip, and directory under exports/.
Non-mobile working directories may opt out with a .non-mobile-export marker.
Verification uses sha256sum in the workspace and macOS shasum when sha256sum
is unavailable.
EOF
}

[[ $# -ge 1 ]] || {
    usage >&2
    exit 2
}

ACTION="$1"
shift

if command -v sha256sum >/dev/null 2>&1; then
    SHA256_COMMAND="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
    SHA256_COMMAND="shasum"
else
    die "required command 'sha256sum' or macOS command 'shasum' was not found"
fi

EXPORT_DIR="$(cd -- "$ROOT_DIR/exports" && pwd -P)"

[[ "$ACTION" == "create" || "$ACTION" == "verify" || "$ACTION" == "audit" ]] || {
    usage >&2
    exit 2
}

select_handoff() {
    local input_path="$1"
    local input_directory input_name

    input_directory="$(dirname -- "$input_path")"
    input_name="$(basename -- "$input_path")"
    [[ -d "$input_directory" ]] || die "handoff does not exist: $input_path"
    HANDOFF_PATH="$(cd -- "$input_directory" && printf '%s/%s\n' "$(pwd -P)" "$input_name")"

    [[ "$HANDOFF_PATH" == "$EXPORT_DIR/"* ]] \
        || die "handoff must be directly under $EXPORT_DIR"
    [[ "$(dirname -- "$HANDOFF_PATH")" == "$EXPORT_DIR" ]] \
        || die "select a top-level file or directory directly under exports/"
    [[ -f "$HANDOFF_PATH" || -d "$HANDOFF_PATH" ]] \
        || die "handoff does not exist: $input_path"
    [[ "$HANDOFF_PATH" != *.sha256 ]] \
        || die "select the handoff, not its checksum manifest"

    HANDOFF_NAME="$(basename -- "$HANDOFF_PATH")"
    MANIFEST_PATH="$HANDOFF_PATH.sha256"
}

hash_file() {
    if [[ "$SHA256_COMMAND" == "sha256sum" ]]; then
        sha256sum -- "$1"
    else
        shasum -a 256 -- "$1"
    fi
}

check_manifest_hashes() {
    if [[ "$SHA256_COMMAND" == "sha256sum" ]]; then
        sha256sum --check --strict "$1" >/dev/null
    else
        shasum -a 256 --check "$1" >/dev/null
    fi
}

create_manifest() {
    local temporary_manifest="$MANIFEST_PATH.tmp"
    rm -f -- "$temporary_manifest"

    if [[ -f "$HANDOFF_PATH" ]]; then
        (
            cd -- "$EXPORT_DIR"
            hash_file "$HANDOFF_NAME"
        ) > "$temporary_manifest"
    else
        (
            cd -- "$EXPORT_DIR"
            find "$HANDOFF_NAME" -type f -print \
                | LC_ALL=C sort \
                | while IFS= read -r file_path; do
                    hash_file "$file_path"
                done
        ) > "$temporary_manifest"
        [[ -s "$temporary_manifest" ]] \
            || die "directory handoff contains no files: $HANDOFF_NAME"
    fi

    mv -- "$temporary_manifest" "$MANIFEST_PATH"
    echo "Created SHA-256 manifest: $MANIFEST_PATH"
}

verify_manifest() {
    local expected_files actual_files invalid_manifest_lines
    [[ -s "$MANIFEST_PATH" ]] \
        || die "checksum manifest is missing: $MANIFEST_PATH"

    invalid_manifest_lines="$(
        sed -E '/^[[:xdigit:]]{64} [ *].+$/d' "$MANIFEST_PATH" | wc -l | tr -d '[:space:]'
    )"
    [[ "$invalid_manifest_lines" == "0" ]] \
        || die "checksum manifest has malformed entries: $MANIFEST_PATH"

    if [[ -d "$HANDOFF_PATH" ]]; then
        expected_files="$(mktemp)"
        actual_files="$(mktemp)"
        trap '[[ -z ${expected_files:-} ]] || rm -f -- "$expected_files"; [[ -z ${actual_files:-} ]] || rm -f -- "$actual_files"' EXIT

        sed -E 's/^[[:xdigit:]]{64} [ *]//' "$MANIFEST_PATH" \
            | LC_ALL=C sort > "$expected_files"
        (
            cd -- "$EXPORT_DIR"
            find "$HANDOFF_NAME" -type f -print | LC_ALL=C sort
        ) > "$actual_files"
        cmp -s -- "$expected_files" "$actual_files" \
            || die "directory contents do not match the manifest (files are missing or extra)"
    fi

    (
        cd -- "$EXPORT_DIR"
        check_manifest_hashes "$(basename -- "$MANIFEST_PATH")"
    )
    echo "Verified complete mobile handoff: $HANDOFF_PATH"
}

audit_manifests() {
    local handoff_path handoff_count=0

    while IFS= read -r -d '' handoff_path; do
        select_handoff "$handoff_path"
        verify_manifest
        handoff_count=$((handoff_count + 1))
    done < <(
        find "$EXPORT_DIR" -mindepth 1 -maxdepth 1 \
            \( \( -type d ! -exec test -e '{}/.non-mobile-export' \; \) -o -type f \( -iname '*.aab' -o -iname '*.zip' \) \) \
            -print0 \
            | LC_ALL=C sort -z
    )

    [[ "$handoff_count" -gt 0 ]] \
        || die "no top-level mobile handoffs were found under $EXPORT_DIR"
    echo "Audited $handoff_count top-level mobile handoffs."
}

case "$ACTION" in
    create)
        if [[ "${1:-}" == "--" ]]; then shift; fi
        [[ $# -eq 1 ]] || { usage >&2; exit 2; }
        select_handoff "$1"
        create_manifest
        verify_manifest
        ;;
    verify)
        if [[ "${1:-}" == "--" ]]; then shift; fi
        [[ $# -eq 1 ]] || { usage >&2; exit 2; }
        select_handoff "$1"
        verify_manifest
        ;;
    audit)
        [[ $# -eq 0 ]] || { usage >&2; exit 2; }
        audit_manifests
        ;;
esac
