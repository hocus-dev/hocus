FROM gcc:12.2.0 as obd-builder
RUN apt-get update && apt-get install -y sudo cmake zlib1g-dev libcurl4-openssl-dev libssl-dev libaio-dev libnl-3-dev libnl-genl-3-dev libgflags-dev libzstd-dev libext2fs-dev
RUN git clone https://github.com/containerd/overlaybd.git
RUN cd overlaybd && git submodule update --init
RUN cd overlaybd && mkdir build && cd build && cmake .. && make && sudo make install

FROM golang:1.20.4-bullseye as obd-convertor-builder
RUN git clone https://github.com/hocus-dev/accelerated-container-image.git && cd accelerated-container-image && git checkout 62f480a697ca68098ff2c91569aeaaf5e5b3463f
RUN cd accelerated-container-image && make bin/convertor && cp ./bin/convertor /convertor

FROM hocusdev/workspace
RUN { curl --retry-all-errors --connect-timeout 5 --retry 5 --retry-delay 0 --retry-max-time 40 -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -; } \
    && DEBIAN_FRONTEND=noninteractive sudo apt-get install -y nodejs qemu-system psmisc expect unzip skopeo jq \
    && sudo npm install --global yarn \
    && fish -c "set -U fish_user_paths \$fish_user_paths ~/.yarn/bin" \
    && echo 'export PATH="~/.yarn/bin:$PATH"' >> ~/.bashrc \
    && sudo yarn global add @vscode/vsce yo generator-code ovsx cspell @cspell/dict-html-symbol-entities @cspell/dict-lorem-ipsum @cspell/dict-npm clinic
RUN cspell link add @cspell/dict-html-symbol-entities && cspell link add @cspell/dict-lorem-ipsum && cspell link add @cspell/dict-npm
RUN echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
RUN curl -fsSL https://tailscale.com/install.sh | sh
# Golang for messing with overlaybd
RUN cd ~/ \
    && mkdir ./go-dl \
    && wget https://go.dev/dl/go1.20.4.linux-amd64.tar.gz -O ./go-dl/go1.20.4.linux-amd64.tar.gz \
    && sudo tar -xvf ./go-dl/go1.20.4.linux-amd64.tar.gz -C /usr/local \
    && rm -r ./go-dl \
    && fish -c "set -U fish_user_paths \$fish_user_paths /usr/local/go/bin/" && echo 'export PATH="/usr/local/go/bin/:$PATH"' >> ~/.bashrc
# Install overlaybd
COPY --from=obd-builder /opt/overlaybd /opt/overlaybd
COPY --from=obd-builder /etc/overlaybd /etc/overlaybd
# Install the overlaybd conversion tool
COPY --from=obd-convertor-builder /convertor /opt/overlaybd/convertor
# Buildkite CLI + agent for running the CI jobs locally ;)
RUN sudo wget https://github.com/buildkite/cli/releases/download/v2.0.0/cli-linux-amd64 -O /usr/bin/bk && sudo chmod +x /usr/bin/bk
RUN curl -sL https://raw.githubusercontent.com/buildkite/agent/main/install.sh | bash && fish -c "set -U fish_user_paths \$fish_user_paths ~/.buildkite-agent/bin" && echo 'export PATH="~/.buildkite-agent/bin:$PATH"' >> ~/.bashrc
# Hadolint :)
RUN sudo wget https://github.com/hadolint/hadolint/releases/download/v2.12.0/hadolint-Linux-x86_64 -O /usr/bin/hadolint && sudo chmod +x /usr/bin/hadolint
# Absurdly fast rust typo finder :3
RUN cd ~/ && mkdir ./typos-dl && wget https://github.com/crate-ci/typos/releases/download/v1.14.5/typos-v1.14.5-x86_64-unknown-linux-musl.tar.gz -O ./typos-dl/typos.tar.gz && tar -xvf ./typos-dl/typos.tar.gz -C ./typos-dl && sudo cp ./typos-dl/typos /usr/bin/typos && rm -r ./typos-dl
# Vale prose checker
RUN cd ~/ && mkdir ./vale-dl && wget https://github.com/errata-ai/vale/releases/download/v2.24.1/vale_2.24.1_Linux_64-bit.tar.gz -O ./vale-dl/vale.tar.gz && tar -xvf ./vale-dl/vale.tar.gz -C ./vale-dl && sudo cp ./vale-dl/vale /usr/bin/vale && rm -r ./vale-dl
# Dprint
RUN curl -fsSL https://dprint.dev/install.sh | sudo bash && fish -c "set -U fish_user_paths \$fish_user_paths ~/.dprint/bin" && echo 'export PATH="~/.dprint/bin:$PATH"' >> ~/.bashrc
# YQ
RUN cd ~/ && mkdir ./yq-dl && wget https://github.com/mikefarah/yq/releases/download/v4.33.3/yq_linux_amd64.tar.gz -O ./yq-dl/yq.tar.gz && tar -xvf ./yq-dl/yq.tar.gz -C ./yq-dl && sudo cp ./yq-dl/yq_linux_amd64 /usr/bin/yq && rm -r ./yq-dl
