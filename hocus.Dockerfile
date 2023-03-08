FROM ubuntu:22.04

RUN apt-get update \
    && { curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -; } \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    curl \
    dialog \
    init \
    iputils-ping \
    net-tools \
    openssh-server \
    sudo \
    util-linux \
    vim \
    nodejs \
    build-essential \
    git-all \
    && npm install --global yarn \
    && rm -rf /var/lib/apt/lists/*
RUN systemctl enable ssh
COPY ./docker/dnssetup /etc/init.d/dnssetup
RUN chmod 755 /etc/init.d/dnssetup && \
    chown root:root /etc/init.d/dnssetup && \
    update-rc.d dnssetup defaults
RUN useradd hocus -m -s /bin/bash && \
    usermod -aG sudo hocus && \
    passwd -d hocus && \
    echo "hocus ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers && \
    chown -R hocus:hocus /home/hocus
COPY ./docker/ssh/sshd_config /etc/ssh/sshd_config
RUN mkdir -p /home/hocus/.ssh && touch /home/hocus/.ssh/known_hosts && \
    ## This adds github.com as a known host - this is vulnerable to MITM but good enough for now
    ssh-keyscan -H github.com >> ~/.ssh/known_hosts && \
    # this public key is automatically removed when a workspace starts
    echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKk+DZs+E2GlmqUNqTCU9/R0kT/zzBjwBqbPaBtGv3MA hocus@prebuild" >> /home/hocus/.ssh/authorized_keys && \
    chown -R hocus:hocus /home/hocus/.ssh && \
    chmod 700 /home/hocus/.ssh && \
    chmod 600 /home/hocus/.ssh/authorized_keys && \
    chmod 600 /home/hocus/.ssh/known_hosts
