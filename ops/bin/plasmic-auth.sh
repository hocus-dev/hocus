#!/bin/bash
set -e

if [ -z "$PLASMIC_AUTH_FILE" ]; then
  echo "PLASMIC_AUTH_FILE is not set"
  exit 0
fi

echo "$PLASMIC_AUTH_FILE" > ~/.plasmic.auth
