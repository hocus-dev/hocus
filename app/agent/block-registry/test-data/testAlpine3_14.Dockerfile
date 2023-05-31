FROM alpine:3.14

RUN apk update \
    && apk add --no-cache openssh-server openrc \
    && mkdir -p /run/openrc \
    && touch /run/openrc/softlevel \
    && sed -ie "s/#PasswordAuthentication yes/PasswordAuthentication yes/g" /etc/ssh/sshd_config \
    && sed -ie "s/#PermitRootLogin prohibit-password/PermitRootLogin yes/g" /etc/ssh/sshd_config \
    && echo "root:root" | chpasswd \
    && rc-status \
    && rc-update add sshd
