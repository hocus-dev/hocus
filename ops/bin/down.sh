#!/bin/bash

OPS_DIR=$(dirname $(dirname "$0"))

cd "$OPS_DIR""/docker" && \
docker compose \
    -p rooms \
    down \
    --remove-orphans || true
