#!/bin/bash
set -o pipefail
set -o xtrace
set -o errexit

export DOCKER_BUILDKIT=1

SCRIPT_DIR="$(dirname "$0")"
REPO_DIR="$SCRIPT_DIR"/../../../../

"$REPO_DIR"/ops/bin/dev/quay-login.sh

TMP_NAME=block-repo-tmp
QUAY_REPO=quay.io/hocus/hocus-block-registry-tests
function build_and_push()
{
  local TEST_NAME=$(basename "$1" | sed 's/\.Dockerfile//')
  docker build -f "$1" "$SCRIPT_DIR"/resources -t "$TMP_NAME:$TEST_NAME"
  skopeo copy --dest-decompress --dest-oci-accept-uncompressed-layers docker-daemon:"$TMP_NAME:$TEST_NAME" oci:"/tmp/$TEST_NAME"
  /opt/overlaybd/bin/convertor --oci -r local-directory -i "/tmp/$TEST_NAME" -o "/tmp/$TEST_NAME-obd"
  rm -rf "/tmp/$TEST_NAME"
  chmod gua+rw "/tmp/$TEST_NAME-obd/index.json" # FIXME: the converter is bugged and creates a file without any permissions
  # https://github.com/containers/skopeo/issues/1505
  # Skopeo doesn't copy annotations which are needed for FastOCI and OverlayBD .-.
  # Generally skopeo is very flaky with regards to the annotations and metadata, sometimes falsifying the mime time...
  # This tool is only needed for pushing oci dumps to a registry, annotations and metadata are preserved when pushing
  crane push "/tmp/$TEST_NAME-obd" "$QUAY_REPO:$TEST_NAME"
}
build_and_push "$SCRIPT_DIR"/test1.Dockerfile
build_and_push "$SCRIPT_DIR"/test2.Dockerfile
build_and_push "$SCRIPT_DIR"/test3.Dockerfile

TEST1_DIGEST=$(skopeo inspect -f "{{ .Digest }}" oci:/tmp/test1-obd/)
TEST2_DIGEST=$(skopeo inspect -f "{{ .Digest }}" oci:/tmp/test2-obd/)
TEST3_DIGEST=$(skopeo inspect -f "{{ .Digest }}" oci:/tmp/test3-obd/)

rm -rf "/tmp/test1-obd"
rm -rf "/tmp/test2-obd"
rm -rf "/tmp/test3-obd"

echo "{\"test1\": \"$QUAY_REPO@$TEST1_DIGEST\", \"test2\": \"$QUAY_REPO@$TEST2_DIGEST\", \"test3\": \"$QUAY_REPO@$TEST3_DIGEST\"}" | jq . > "$SCRIPT_DIR"/test_images.json
