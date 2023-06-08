FROM alpine:3.18

RUN apk add \
    curl \
    dialog \
    openrc \
    iputils-ping \
    net-tools \
    openssh-server \
    openssh-client \
    sudo \
    util-linux \
    git \
    git-lfs
COPY ./docker/alpine/dnssetup /etc/init.d/dnssetup
COPY ./docker/ssh/sshd_config_password /etc/ssh/sshd_config
RUN chmod 755 /etc/init.d/dnssetup && \
    chown root:root /etc/init.d/dnssetup
RUN rc-update add sshd && \
    rc-update add dnssetup
RUN adduser -s /bin/sh -h /home/hocus -D hocus && \
    echo '%wheel ALL=(ALL) ALL' > /etc/sudoers.d/wheel && \
    adduser hocus wheel && \
    echo "hocus ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers && \
    chown -R hocus:hocus /home/hocus && \
    echo 'hocus:hocus' | chpasswd
RUN git lfs install
