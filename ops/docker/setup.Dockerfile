FROM ubuntu:latest

WORKDIR /build
RUN apt-get update && apt-get install -y curl wget qemu-system psmisc expect
RUN curl --retry-all-errors --connect-timeout 5 --retry 5 --retry-delay 0 --retry-max-time 40 https://get.docker.com/ | sh
COPY ops/ ops/
COPY resources resources/
