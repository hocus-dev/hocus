FROM alpine:3.14

WORKDIR /build

RUN apk add bash curl wget
COPY ops/ ops/
COPY resources resources/
