<p align="center">
  <img alt="hocus-gh-bg" src="https://user-images.githubusercontent.com/28019628/227353685-63f8e3bb-fbf9-446b-a6bd-f15fc53c9a52.png">
</p>

<p align="center">
   <a href="https://hocus.dev">
      <img alt="Website" src="https://img.shields.io/badge/website-hocus.dev-blue"/>
   </a>
   <img alt="Language" src="https://img.shields.io/badge/platform-linux-lightgrey"/>
   <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/hocus-dev/hocus"/>
<p>

<p align="center">
  <a href="https://hocus.dev/docs">Docs</a> - <a href="https://github.com/hocus-dev/hocus/issues/new?assignees=&labels=bug">Bug report</a>
</p>

## Hocus is a self-hosted alternative to Gitpod and Github Codespaces.

- Spin up disposable development environments on servers that you manage
- Save time with prebuilds - stop waiting for code to compile and dependencies to install
- Specify your development environment setup as code
- Onboard new team members faster
- Develop on a powerful remote server rather than a laptop

# Contributing

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/hugodutka/rooms)

The gitpod environment contains the Control Plane together with all support services. The env expects the following environment variables:

- `TAILSCALE_LOGIN_SERVER - If using tailscale set to `https://controlplane.tailscale.com`, otherwise set to the headscale url. Required when developing the agent.
- `TAILSCALE_PREAUTHKEY` - Preauth key for the machine, used to authorize the env to tailscale. Required when developing the agent.
- `DEV_MACHINE_PRIVATE_SSH_KEY` - Private key used to synchronize the codebase with the machine the Hocus agent is running on. Please remember to add \n to the private key for gitpod to work. Required when developing the agent.
- `DEV_MACHINE_USER` - the user used for syncing the codebase with the machine the agent is running on. Required when developing the agent.
- `DEV_MACHINE_HOSTNAME` - the hostname used for syncing the codebase with the machine the agent is running on. Set to tailscale ip or MagicDNS of the machine with the agent. Required when developing the agent.
- `CONTROL_PLANE_AGENT_HOSTNAME` - the hostname or ip where your vscode should connect to, by default it's set to `localhost` but when developing over tailscale you probably want to set it to `DEV_MACHINE_HOSTNAME`. When on LAN you may set it to the LAN address of the machine the agent is running on.

## Control plane

Just open the repo in gitpod and it should work. `localhost:3000` for the control plane. `localhost:3000/app/projects` to see the vms. Dev user Keycloak password is `dev/dev`. Admin Keycloak password is `admin/admin`.

## Hocus Local Vscode extension

**MUST BE DEVELOPED LOCALLY**

I haven't figured out a way to develop an UI extension via gitpod - vscode just refuses to load the extension. Workspace extensions inside gitpod work. Manually loading a packaged prerelease worked but it was a hassle and I couldn't attach a debugger to it .-. The thing is that inside gitpod there is a CUSTOM vscode server - it's possible that this was the reason I couldn't develop an UI extension there.

[Here](extensions/vscode_ui/CONTRIBUTING.md) are some docs.

## Hocus Remote Vscode extension

**TODO**

## Agent

For now you need a baremetal machine for it with KVM, Linux and Docker. The setup is _temporary_ and delibrately **jank**, we aim to move Hocus developement to Hocus via nested KVM.

1. Connect the target machine to tailscale, setup SSH, docker and sudo on it, have an admin user(for me `gorbak25`) where u want to work, ensure u have ssh access to the admin account via tailscale to this machine.
2. From the admin account create a low priviledged user for syncing the code between gitpod and the machine `DEV_MACHINE_USER=hocus sudo -e DEV_MACHINE_USER useradd -m $DEV_MACHINE_USER`.
3. Grant yourself access to that user `sudo usermod -a -G hocus gorbak25; sudo -u $DEV_MACHINE_USER chmod g+x ~`
4. Set up a **new** ssh key which has access to `$DEV_MACHINE_USER` and then proceed to set up the env inside the gitpod environment
5. Create the directory structure for the agent

```sh
mkdir /home/$DEV_MACHINE_USER/dev
mkdir /home/$DEV_MACHINE_USER/dev/hocus
mkdir /home/$DEV_MACHINE_USER/dev/hocus-resources/
mkdir /home/$DEV_MACHINE_USER/dev/hocus-resources/firecracker
mkdir /home/$DEV_MACHINE_USER/dev/hocus-resources/resources/
```

6. Create a new Gitpod workspace, log into it and ensure that every script executed properly - you know that it worked when `/home/$DEV_MACHINE_USER/dev/hocus` was populated with the source code you are currently working on in gitpod :)
7. Grant yourself access to the the code `sudo chmod -R g+rwx /home/hocus/dev`
8. Start a dind container which will be used for building the rootfs for the VM. The container needs to be priviledged as it needs to mount the VM image it builds.
   `docker run -v /var/run/docker.sock:/var/run/docker.sock -v /home/hocus:/home/hocus -it --privileged ubuntu:latest`
9. Inside dind install docker `apt-get update; curl https://get.docker.com/ | sh`
10. Inside dind build the VM filesystem
    ```bash
    cd /home/hocus/dev/hocus
    ops/bin/buildfs.sh resources/docker/checkout-and-inspect.Dockerfile ../hocus-resources/resources/checkout-and-inspect.ext4 resources/ 500
    ops/bin/buildfs.sh resources/docker/default-workspace.Dockerfile ../hocus-resources/resources/default-workspace.ext4 resources/ 1500
    ops/bin/buildfs.sh resources/docker/buildfs.Dockerfile ../hocus-resources/resources/buildfs.ext4 resources/ 1000
    ops/bin/buildfs.sh resources/docker/fetchrepo.Dockerfile ../hocus-resources/fetchrepo.ext4 resources 2500
    cd /home/hocus/dev/hocus-resources
    mv fetchrepo.ext4 resources/
    cp resources/buildfs.ext4 resources/test-buildfs.ext4
    ```
    After it's done exit dind
11. Set up the linux kernel - for now get it either from @gorbak25 or @hugodutka place it under `/home/hocus/dev/hocus-resources/resources/vmlinux-5.6-x86_64.bin`
12. Start the agent! In the admin account `cd /home/hocus/dev/hocus; ./ops/bin/run-worker-dev.sh`

# Welcome to Remix!

- [Remix Docs](https://remix.run/docs)

## Development

Start the Remix development asset server and the Express server by running:

```sh
npm run dev
```

This starts your app in development mode, which will purge the server require cache when Remix rebuilds assets so you don't need a process manager restarting the express server.

## How to pg_dump the keycloak database

```bash
docker run --network=host -it -e PGPASSWORD=pass postgres:alpine pg_dump -h localhost -U postgres keycloak > ops/docker/resources/keycloak-db-dump.sql
```

## Tests

Temporal is buggy and does not clean up properly after itself in tests. That's why tests are best run with the `--forceExit` flag for now.
There is a Github issue that tracks this bug: https://github.com/temporalio/sdk-typescript/issues/928

How to test activities:

```bash
yarn jest --testTimeout 600000 --forceExit app/agent/activities.test.ts
```

How to test workflows:

```bash
yarn jest 'app/agent/workflows.test.ts' -t 'runBuildfsAndPrebuilds' --testTimeout 600000
```

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying express applications you should be right at home just make sure to deploy the output of `remix build`

- `build/`
- `public/build/`

### Using a Template

When you ran `npx create-remix@latest` there were a few choices for hosting. You can run that again to create a new project, then copy over your `app/` folder to the new project that's pre-configured for your target server.

```sh
cd ..
# create a new project, and pick a pre-configured host
npx create-remix@latest
cd my-new-remix-app
# remove the new project's app (not the old one!)
rm -rf app
# copy your app over
cp -R ../my-old-remix-app/app app
```

### License

This repository's code is licensed under the Elastic License v2.0, except for the `extensions` directory and its subdirectories, which are licensed under MIT.
