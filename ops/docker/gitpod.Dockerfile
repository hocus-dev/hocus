FROM gitpod/workspace-full

RUN sudo apt-get install -y rsync xdg-utils
RUN yarn config set cache-folder /workspace/.yarn-cache
RUN yarn global add @vscode/vsce yo generator-code ovsx
