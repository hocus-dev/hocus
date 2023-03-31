FROM hocusdev/workspace

RUN { curl --retry-all-errors --connect-timeout 5 --retry 5 --retry-delay 0 --retry-max-time 40 -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -; } \
    && DEBIAN_FRONTEND=noninteractive sudo apt-get install -y nodejs \
    && sudo npm install --global yarn \
    && fish -c "set -U fish_user_paths \$fish_user_paths ~/.yarn/bin" \
    && sudo yarn global add @vscode/vsce yo generator-code ovsx
RUN echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
RUN curl -fsSL https://tailscale.com/install.sh | sh
