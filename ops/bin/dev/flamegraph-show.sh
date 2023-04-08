#!/bin/bash

export SCRIPT_DIR="$(dirname "$0")"
export REPO_DIR="$(realpath "${SCRIPT_DIR}/../../..")"

python3 -m http.server --directory "$REPO_DIR/.clinic/"
