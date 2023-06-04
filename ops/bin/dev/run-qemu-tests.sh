#!/bin/bash

docker exec -it "$(docker ps | grep worker-dev | grep -o -e '^[0-9a-f]*')" bash -c "TEST_STATE_MANAGER_SOCK=/srv/jailer/test-state-manager.sock node --trace-warnings node_modules/.bin/jest --detectOpenHandles --maxWorkers=16 --maxConcurrency=32 --testTimeout 30000 app/agent/runtime/qemu/qemu.service.test.ts"
