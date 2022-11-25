FROM node:16-bullseye

RUN wget -q https://github.com/firecracker-microvm/firecracker/releases/download/v1.1.2/firecracker-v1.1.2-x86_64.tgz && \
    tar -xf firecracker-v1.1.2-x86_64.tgz && \
    mv release-v1.1.2-x86_64/firecracker-v1.1.2-x86_64 /usr/local/bin/firecracker && \
    mv release-v1.1.2-x86_64/jailer-v1.1.2-x86_64 /usr/local/bin/jailer
RUN yarn config set cache-folder /app/.yarn-cache
RUN apt-get update && apt-get install -y net-tools iproute2 iptables psmisc
RUN apt-get update && apt-get install -y socat openssh-server
RUN apt-get update && apt-get install -y iputils-ping
RUN test -f /usr/sbin/nologin && useradd -ms /usr/sbin/nologin sshgateway
COPY --chown=root:root --chmod=0644 resources/sshd_config /etc/ssh/sshd_config

WORKDIR /app
