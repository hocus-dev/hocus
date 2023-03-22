#!/bin/bash

export DOCKER_BUILDKIT=1

TAG=$(date +"%d-%m-%Y")
docker build --tag hocusdev/hocus-workspace:$TAG -f hocus.Dockerfile resources
docker tag hocusdev/hocus-workspace:$TAG hocusdev/hocus-workspace:latest
docker push hocusdev/hocus-workspace:$TAG
docker push hocusdev/hocus-workspace:latest
