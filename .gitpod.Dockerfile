FROM gitpod/workspace-full

RUN yarn global add @plasmicapp/cli
RUN echo 'export PATH="$PATH'":$(yarn global bin)\"" >> ~/.bashrc
