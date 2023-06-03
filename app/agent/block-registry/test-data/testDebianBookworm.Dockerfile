FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install --no-install-recommends -y openssh-server systemd systemd-sysv \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && sed -ie "s/#PasswordAuthentication yes/PasswordAuthentication yes/g" /etc/ssh/sshd_config \
    && sed -ie "s/#PermitRootLogin prohibit-password/PermitRootLogin yes/g" /etc/ssh/sshd_config \
    && echo "root:root" | chpasswd
