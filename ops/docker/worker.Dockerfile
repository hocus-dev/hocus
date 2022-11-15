FROM node:16-bullseye

RUN wget -q https://github.com/firecracker-microvm/firecracker/releases/download/v1.1.2/firecracker-v1.1.2-x86_64.tgz && \
    tar -xf firecracker-v1.1.2-x86_64.tgz && \
    mv release-v1.1.2-x86_64/firecracker-v1.1.2-x86_64 /usr/local/bin/firecracker && \
    mv release-v1.1.2-x86_64/jailer-v1.1.2-x86_64 /usr/local/bin/jailer
RUN yarn config set cache-folder /app/.yarn-cache
RUN apt-get update && apt-get install -y net-tools iproute2 iptables psmisc
RUN apt-get update && apt-get install -y software-properties-common
RUN curl https://haproxy.debian.net/bernat.debian.org.gpg  \
        | gpg --dearmor > /usr/share/keyrings/haproxy.debian.net.gpg && \
    echo deb "[signed-by=/usr/share/keyrings/haproxy.debian.net.gpg]" \
        http://haproxy.debian.net bullseye-backports-2.6 main \
        > /etc/apt/sources.list.d/haproxy.list
RUN apt-get update && apt-get install -y haproxy=2.6.\*
RUN mkdir -p /tmp/haproxy && \
    cd /tmp/haproxy && \
    wget -q https://github.com/haproxytech/dataplaneapi/releases/download/v2.6.1/dataplaneapi_2.6.1_Linux_x86_64.tar.gz && \
    tar -xf dataplaneapi_2.6.1_Linux_x86_64.tar.gz && \
    mv build/dataplaneapi /usr/local/bin/dataplaneapi && \
    cd / && \
    rm -rf /tmp/haproxy

WORKDIR /app
