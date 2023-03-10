FROM gcc:12.2.0 as dtach-builder

RUN git clone https://github.com/hocus-dev/dtach \
     && cd dtach \
     && git checkout 9691ed5322c8e599cce6a3fbcae04ac483fa727f
WORKDIR /dtach
RUN ./configure LDFLAGS="-static -s" CFLAGS="-O3" && make

FROM ubuntu:22.04
COPY --from=dtach-builder /dtach/dtach /usr/bin/
RUN dtach --version
RUN apt-get update \
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
    tmux \
    build-essential \
    fish \
    zsh \
    ash \
    git-all \
    git-lfs \
    && { curl -fsSL https://deb.nodesource.com/setup_18.x | bash -; } \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs \
    && npm install --global yarn \
    && { curl https://get.docker.com/ | bash -; } \
    && rm -rf /var/lib/apt/lists/*
RUN systemctl enable ssh docker
COPY ./docker/dnssetup /etc/init.d/dnssetup
RUN chmod 755 /etc/init.d/dnssetup && \
    chown root:root /etc/init.d/dnssetup && \
    update-rc.d dnssetup defaults
RUN useradd hocus -m -s /bin/bash && \
    usermod -aG docker hocus && \
    usermod -aG sudo hocus && \
    passwd -d hocus && \
    echo "hocus ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers && \
    chown -R hocus:hocus /home/hocus
COPY ./docker/ssh/sshd_config /etc/ssh/sshd_config
RUN mkdir -p /home/hocus/.ssh && touch /home/hocus/.ssh/known_hosts && \
    ## This adds github.com as a known host - this is vulnerable to MITM but good enough for now
    ssh-keyscan -H github.com >> /home/hocus/.ssh/known_hosts && \
    # this public key is automatically removed when a workspace starts
    echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKk+DZs+E2GlmqUNqTCU9/R0kT/zzBjwBqbPaBtGv3MA hocus@prebuild" >> /home/hocus/.ssh/authorized_keys && \
    chown -R hocus:hocus /home/hocus/.ssh && \
    chmod 700 /home/hocus/.ssh && \
    chmod 600 /home/hocus/.ssh/authorized_keys && \
    chmod 600 /home/hocus/.ssh/known_hosts
RUN echo 'set -g default-terminal "tmux-256color"' >> /home/hocus/.tmux.conf
