#!/bin/bash

set -o errexit
set -o pipefail
set -o nounset

ops/bin/restart.sh
ops/bin/temporal-down.sh
ops/bin/temporal-up.sh
