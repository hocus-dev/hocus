FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    curl \
    dialog \
    init \
    iputils-ping \
    net-tools \
    openssh-server \
    sudo \
    util-linux \
    vim \
    jq \
    htop
RUN systemctl enable ssh
COPY ./docker/dnssetup /etc/init.d/dnssetup
RUN chmod 755 /etc/init.d/dnssetup && \
    chown root:root /etc/init.d/dnssetup && \
    update-rc.d dnssetup defaults
RUN curl --retry-all-errors --connect-timeout 5 --retry 5 --retry-delay 0 --retry-max-time 40 -sSL https://get.docker.com/ | sh \
    # Symlink docker-compose for compatibility
    && ln -s /usr/libexec/docker/cli-plugins/docker-compose /usr/bin/docker-compose
 RUN echo 'root:root' | chpasswd
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/g' /etc/ssh/sshd_config

# Install YQ
RUN cd ~/ && mkdir ./yq-dl && wget https://github.com/mikefarah/yq/releases/download/v4.33.3/yq_linux_amd64.tar.gz -O ./yq-dl/yq.tar.gz && tar -xvf ./yq-dl/yq.tar.gz -C ./yq-dl && sudo cp ./yq-dl/yq_linux_amd64 /usr/bin/yq && rm -r ./yq-dl

# Install Buildkite Agent
RUN curl -fsSL https://keys.openpgp.org/vks/v1/by-fingerprint/32A37959C2FA5C3C99EFBC32A79206696452D198 | gpg --dearmor -o /usr/share/keyrings/buildkite-agent-archive-keyring.gpg
RUN echo "deb [signed-by=/usr/share/keyrings/buildkite-agent-archive-keyring.gpg] https://apt.buildkite.com/buildkite-agent stable main" | tee /etc/apt/sources.list.d/buildkite-agent.list
RUN apt-get update && apt-get install -y buildkite-agent

# Install docuum
RUN wget https://github.com/stepchowfun/docuum/releases/download/v0.22.0/docuum-x86_64-unknown-linux-gnu -O /usr/bin/docuum && chmod +x /usr/bin/docuum
COPY ./buildkite/docuum.service /etc/systemd/system/docuum.service
RUN systemctl enable docuum

# Configure Buildkite Agent & Docker
COPY ./buildkite/hooks/fix-buildkite-agent-builds-permissions /usr/bin/
COPY ./buildkite/hooks/environment /etc/buildkite-agent/hooks/environment
COPY ./buildkite/buildkite-agent.cfg /etc/buildkite-agent/buildkite-agent.cfg
COPY ./buildkite/daemon.json /etc/docker/daemon.json
RUN systemctl enable buildkite-agent && usermod -aG docker buildkite-agent && echo "buildkite-agent ALL = (root) NOPASSWD: /usr/bin/fix-buildkite-agent-builds-permissions" >> /etc/sudoers
