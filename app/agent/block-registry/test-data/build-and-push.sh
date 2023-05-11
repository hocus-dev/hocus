#!/bin/bash
export DOCKER_BUILDKIT=1

SCRIPT_DIR="$(dirname "$0")"

EXISTING_TOKEN=$(cat ~/.docker/config.json 2>/dev/null | jq '.auths."quay.io".auth' 2>/dev/null)
if [[ ! -f "$HOME/.docker/config.json" ]] || [[ "$EXISTING_TOKEN" = "null" ]]; then  
  echo "$EXISTING_TOKEN"
  docker login quay.io -u gorbak25
fi

QUAY_REPO=quay.io/gorbak25/hocus-block-registry-tests
docker build --push -f "$SCRIPT_DIR"/test1.Dockerfile "$SCRIPT_DIR"/resources -t $QUAY_REPO:test1
docker build --push -f "$SCRIPT_DIR"/test2.Dockerfile "$SCRIPT_DIR"/resources -t $QUAY_REPO:test2
docker build --push -f "$SCRIPT_DIR"/test3.Dockerfile "$SCRIPT_DIR"/resources -t $QUAY_REPO:test3
TEST1_DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' $QUAY_REPO:test1)
TEST2_DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' $QUAY_REPO:test2)
TEST3_DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' $QUAY_REPO:test3)

echo "{\"test1\": \"$TEST1_DIGEST\", \"test2\": \"$TEST2_DIGEST\", \"test3\": \"$TEST3_DIGEST\"}" | jq . > "$SCRIPT_DIR"/test_images.json