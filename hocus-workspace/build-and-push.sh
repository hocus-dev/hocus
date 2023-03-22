#!/bin/bash

export DOCKER_BUILDKIT=1

TAG=$(date +"%d-%m-%Y")
docker build --tag hocusdev/hocus-workspace:$TAG -f hocus.Dockerfile resources
docker push hocusdev/hocus-workspace:$TAG
