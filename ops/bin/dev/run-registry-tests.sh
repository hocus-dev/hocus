#!/bin/bash

docker exec -it "$(docker ps | grep worker-dev | grep -o -e '^[0-9a-f]*')" bash -c "UV_THREADPOOL_SIZE=64 TEST_STATE_MANAGER_SOCK=/srv/jailer/test-state-manager.sock yarn jest --testTimeout 20000 app/agent/block-registry/registry.service.test.ts"
