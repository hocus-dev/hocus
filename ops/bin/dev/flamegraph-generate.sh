#!/bin/bash

if [ -z "$1" ]; then
  echo "./ops/bin/dev/flamegraph-generate.sh [entrypoint]"
  exit 1
fi

clinic flame -- node -r ts-node/register -r tsconfig-paths/register $1

echo "Run ./ops/bin/flamegraph-show.sh to start a webserver and browse the results :)"
