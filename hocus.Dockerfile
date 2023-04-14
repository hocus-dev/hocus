FROM hocusdev/workspace

RUN { curl --retry-all-errors --connect-timeout 5 --retry 5 --retry-delay 0 --retry-max-time 40 -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -; } \
    && DEBIAN_FRONTEND=noninteractive sudo apt-get install -y nodejs qemu-system psmisc expect unzip \
    && sudo npm install --global yarn \
    && fish -c "set -U fish_user_paths \$fish_user_paths ~/.yarn/bin" \
    && echo 'export PATH="~/.yarn/bin:$PATH"' >> ~/.bashrc \
    && sudo yarn global add @vscode/vsce yo generator-code ovsx cspell @cspell/dict-html-symbol-entities @cspell/dict-lorem-ipsum @cspell/dict-npm clinic
RUN cspell link add @cspell/dict-html-symbol-entities && cspell link add @cspell/dict-lorem-ipsum && cspell link add @cspell/dict-npm
RUN echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
RUN curl -fsSL https://tailscale.com/install.sh | sh
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
