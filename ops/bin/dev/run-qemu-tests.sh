#!/bin/bash

docker exec -it "$(docker ps | grep worker-dev | grep -o -e '^[0-9a-f]*')" bash -c "TEST_STORAGE_DIR=/srv/jailer/tests OCI_PROXY=host.docker.internal:9999 node --trace-warnings node_modules/.bin/jest --detectOpenHandles --maxWorkers=16 --maxConcurrency=8 --testTimeout 30000 app/agent/runtime/qemu/qemu.service.test.ts"
