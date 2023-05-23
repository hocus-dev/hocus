FROM gcc:12.2.0-bullseye as obd-builder
RUN apt-get update \
    && apt-get -y --no-install-recommends install software-properties-common \
    && add-apt-repository "deb http://httpredir.debian.org/debian sid main" \
    && apt-get update \
    && apt-get -t sid install -y sudo cmake zlib1g-dev libcurl4-openssl-dev libssl3 libssl-dev libaio-dev libnl-3-dev libnl-genl-3-dev libgflags-dev libzstd-dev libext2fs-dev
RUN git clone https://github.com/hocus-dev/overlaybd.git && cd overlaybd && git checkout a52cabb627a5e3e50f3d364ac8a6a061b1bb6ff7
RUN cd overlaybd && git submodule update --init
RUN cd overlaybd && mkdir build && cd build && cmake .. && make && sudo make install

FROM golang:1.20.4-bullseye as obd-convertor-builder
RUN git clone https://github.com/hocus-dev/accelerated-container-image.git && cd accelerated-container-image && git checkout 62f480a697ca68098ff2c91569aeaaf5e5b3463f
RUN cd accelerated-container-image && make bin/convertor && cp ./bin/convertor /convertor

FROM node:18-bullseye

RUN wget --continue --retry-connrefused --waitretry=1 --timeout=20 --tries=3 -q https://github.com/firecracker-microvm/firecracker/releases/download/v1.1.2/firecracker-v1.1.2-x86_64.tgz && \
    tar -xf firecracker-v1.1.2-x86_64.tgz && \
    mv release-v1.1.2-x86_64/firecracker-v1.1.2-x86_64 /usr/local/bin/firecracker && \
    mv release-v1.1.2-x86_64/jailer-v1.1.2-x86_64 /usr/local/bin/jailer
RUN yarn config set cache-folder /app/.yarn-cache
RUN apt-get update \
    && apt-get -y --no-install-recommends install software-properties-common \
    && add-apt-repository "deb http://httpredir.debian.org/debian sid main" \
    && apt-get update \
    && apt-get -t sid install -y skopeo net-tools iproute2 iptables psmisc socat openssh-server iputils-ping tmux libaio1 libnl-3-200 libnl-genl-3-200
RUN test -f /usr/sbin/nologin && useradd -ms /usr/sbin/nologin sshgateway
COPY --chown=root:root --chmod=0644 ops/docker/resources/sshd_config /etc/ssh/sshd_config

# Install overlaybd
COPY --from=obd-builder /opt/overlaybd /opt/overlaybd
COPY --from=obd-builder /etc/overlaybd /etc/overlaybd
RUN chmod u+s /opt/overlaybd/bin/overlaybd-apply
# Install the overlaybd conversion tool
COPY --from=obd-convertor-builder /convertor /opt/overlaybd/bin/convertor

WORKDIR /app
COPY ops/bin/override-prisma-types.sh ops/bin/override-prisma-types.sh
COPY deps deps
COPY package.json yarn.lock ./
RUN --mount=type=cache,id=hocus-tests-yarn,sharing=locked,target=/usr/local/share/.cache/yarn \
   yarn --frozen-lockfile
COPY prisma prisma
RUN yarn run regen
COPY . .
