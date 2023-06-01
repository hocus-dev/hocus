#!/bin/bash

docker exec -it $(docker ps | grep worker-dev | grep -o -e '^[0-9a-f]*') bash -c "node --trace-warnings node_modules/.bin/jest --maxWorkers=16 --testTimeout 20000 app/agent/runtime/qemu"
