#!/bin/bash

export DOCKER_BUILDKIT=1

TAG=$(date +"%d-%m-%Y")
docker build --tag hocusdev/workspace:$TAG -f hocus.Dockerfile resources
docker tag hocusdev/workspace:$TAG hocusdev/workspace:latest
docker push hocusdev/workspace:$TAG
docker push hocusdev/workspace:latest
