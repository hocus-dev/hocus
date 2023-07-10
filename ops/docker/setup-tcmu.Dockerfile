FROM alpine:3.14
RUN apk add bash

WORKDIR /workdir

COPY ops/ ops/
