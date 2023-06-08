#!/bin/bash

docker exec -it "$(docker ps | grep worker-dev | grep -o -e '^[0-9a-f]*')" bash -c "TEST_STORAGE_DIR=/srv/jailer/tests/ OCI_PROXY=host.docker.internal:9999 yarn jest --testTimeout 20000 app/agent/block-registry/registry.service.test.ts"
