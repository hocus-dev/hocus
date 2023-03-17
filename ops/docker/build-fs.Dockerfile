FROM ubuntu:latest

WORKDIR /build
RUN apt-get update && apt-get install -y curl wget
RUN curl https://get.docker.com/ | sh
COPY ops/ ops/
COPY resources resources/
