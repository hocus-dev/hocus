#!/bin/bash
set -o pipefail
set -o xtrace
set -o errexit

export DOCKER_BUILDKIT=1

SCRIPT_DIR="$(dirname "$0")"
REPO_DIR="$SCRIPT_DIR"/../../../../

"$REPO_DIR"/ops/bin/dev/quay-login.sh

TMP_NAME=block-repo-tmp
QUAY_REPO=hocus/hocus-block-registry-tests
RES=""
function build_and_push()
{
  local TEST_NAME
  TEST_NAME=$(basename "$1" | sed 's/\.Dockerfile//')
  docker build -f "$1" "$SCRIPT_DIR"/resources -t "$TMP_NAME:$TEST_NAME"
  skopeo copy --dest-decompress --dest-oci-accept-uncompressed-layers docker-daemon:"$TMP_NAME:$TEST_NAME" oci:"/tmp/$TEST_NAME"
  /opt/overlaybd/bin/convertor --oci -r local-directory -i "/tmp/$TEST_NAME" -o "/tmp/$TEST_NAME-obd"
  rm -rf "/tmp/$TEST_NAME"
  chmod gua+rw "/tmp/$TEST_NAME-obd/index.json" # FIXME: the converter is bugged and creates a file without any permissions
  # https://github.com/containers/skopeo/issues/1505
  # Skopeo doesn't copy annotations which are needed for FastOCI and OverlayBD .-.
  # Generally skopeo is very flaky with regards to the annotations and metadata, sometimes falsifying the mime time...
  # This tool is only needed for pushing oci dumps to a registry, annotations and metadata are preserved when pushing
  crane push "/tmp/$TEST_NAME-obd" "quay.io/$QUAY_REPO:$TEST_NAME"

  DIGEST=$(skopeo inspect -f "{{ .Digest }}" "oci:/tmp/$TEST_NAME-obd/")
  rm -rf "/tmp/$TEST_NAME-obd"
  RES="$RES, \"$TEST_NAME\": \`\${repo}/$QUAY_REPO@$DIGEST\`"
}
build_and_push "$SCRIPT_DIR"/test1.Dockerfile
build_and_push "$SCRIPT_DIR"/test2.Dockerfile
# Alpine images are 10Mb so they are preferred in tests
build_and_push "$SCRIPT_DIR"/testAlpine3_14.Dockerfile
build_and_push "$SCRIPT_DIR"/testAlpine3_14NoSSH.Dockerfile
# Debian/Ubuntu images are 100Mb each, good enough to enable in CI for now
# https://wiki.debian.org/DebianReleases
build_and_push "$SCRIPT_DIR"/testDebianBookworm.Dockerfile
build_and_push "$SCRIPT_DIR"/testDebianBuster.Dockerfile
# https://ubuntu.com/about/release-cycle
build_and_push "$SCRIPT_DIR"/testUbuntuFocal.Dockerfile
build_and_push "$SCRIPT_DIR"/testUbuntuJammy.Dockerfile
# BTW I use arch with self compiled zfs from git + zfsbootmenu
# The image is 0.5GB
 build_and_push "$SCRIPT_DIR"/testArchlinux.Dockerfile
# For completion use nixos the image is 0.8GB
 build_and_push "$SCRIPT_DIR"/testNixos.Dockerfile

RES="${RES:1}"
echo -e "/* eslint-disable */\nconst repo = process.env.OCI_PROXY ?? \"quay.io\";\nexport const testImages = {$RES} as const" | npx prettier --stdin-filepath test-images.const.ts > "$SCRIPT_DIR"/test-images.const.ts
