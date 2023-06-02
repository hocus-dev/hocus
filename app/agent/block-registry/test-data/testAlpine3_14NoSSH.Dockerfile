FROM alpine:3.14

RUN apk update \
    && apk add --no-cache openrc \
    && mkdir -p /run/openrc \
    && touch /run/openrc/softlevel \
    && echo "root:root" | chpasswd \
    && rc-status
    