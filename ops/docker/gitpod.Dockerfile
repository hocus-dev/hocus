FROM gitpod/workspace-full

RUN sudo apt-get install -y rsync
RUN yarn config set cache-folder /workspace/.yarn-cache
RUN yarn global add @vscode/vsce yo generator-code ovsx
RUN git lfs install
