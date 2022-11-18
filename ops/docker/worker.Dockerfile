FROM node:16-bullseye

RUN wget -q https://github.com/firecracker-microvm/firecracker/releases/download/v1.1.2/firecracker-v1.1.2-x86_64.tgz && \
    tar -xf firecracker-v1.1.2-x86_64.tgz && \
    mv release-v1.1.2-x86_64/firecracker-v1.1.2-x86_64 /usr/local/bin/firecracker && \
    mv release-v1.1.2-x86_64/jailer-v1.1.2-x86_64 /usr/local/bin/jailer
RUN yarn config set cache-folder /app/.yarn-cache
RUN apt-get update && apt-get install -y net-tools iproute2 iptables psmisc
RUN apt-get update && apt-get install -y socat openssh-server
RUN sed -i 's/#ListenAddress .*/ListenAddress 10.10.10.20/' /etc/ssh/sshd_config

WORKDIR /app
