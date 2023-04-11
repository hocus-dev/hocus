#!/bin/bash

export DOCKER_BUILDKIT=1

TAG=$(date +"%d-%m-%Y")
docker build --tag hocusdev/workspace-base:$TAG -f workspace-base.Dockerfile resources
docker tag hocusdev/workspace-base:$TAG hocusdev/workspace-base:latest
docker push hocusdev/workspace-base:$TAG
docker push hocusdev/workspace-base:latest
