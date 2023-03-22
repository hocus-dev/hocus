FROM hocusdev/hocus-workspace

RUN { curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -; } \
    && DEBIAN_FRONTEND=noninteractive sudo apt-get install -y nodejs \
    && sudo npm install --global yarn \
    && fish -c "set -U fish_user_paths \$fish_user_paths ~/.yarn/bin" \
    && sudo yarn global add @vscode/vsce yo generator-code ovsx
