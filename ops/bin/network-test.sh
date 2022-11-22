#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

expect_fail() {
  "$@" && exit 1 || true
}

httptest() {
  local address="$1"
  local netns="${2:-""}"
  if [ -z "$netns" ]; then
    curl -s -m 1 "$address" > /dev/null
  else
    ip netns exec "$netns" curl -s -m 1 "$address" > /dev/null
  fi
}

killall python3 || true

ip netns exec ssh python3 -m http.server -b 10.10.0.1 &
ip netns exec vms python3 -m http.server -b 10.231.0.1 &
python3 -m http.server -b 0.0.0.0 &
sleep 1

httptest 10.10.0.1:8000
httptest 10.231.0.1:8000
httptest 127.0.0.1:8000

expect_fail httptest 10.10.0.0:8000 ssh

killall python3
