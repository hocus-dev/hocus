<p align="center">
  <img alt="hocus-gh-bg" src="https://user-images.githubusercontent.com/28019628/227353685-63f8e3bb-fbf9-446b-a6bd-f15fc53c9a52.png">
</p>

<p align="center">
   <a href="https://hocus.dev">
      <img alt="Website" src="https://img.shields.io/badge/website-hocus.dev-blue"/>
   </a>
   <img alt="Language" src="https://img.shields.io/badge/platform-linux-green"/>
   <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/hocus-dev/hocus"/>
<p>

<p align="center">
  <a href="https://hocus.dev/docs">Docs</a> - <a href="https://github.com/hocus-dev/hocus/issues/new?assignees=&labels=bug">Bug report</a>
</p>

**Hocus** is a self-hosted application that spins up ready-to-code, disposable development environments on your own servers in seconds. You define your dev environments as code and launch them instantly from your browser.

Hocus is integrated with any Git provider that supports the SSH protocol, like GitHub, GitLab, BitBucket, or Gitea. It prebuilds dev environments on every commit for all branches like a CI system, enabling your team members to start coding with fresh, fully-configured dev environments right away. Whether you're fixing a bug, building a new feature, or conducting a code review, Hocus has you covered.

## Features

![hocus-demo-3](https://user-images.githubusercontent.com/28019628/227723898-09a9ac73-ab36-4fb2-a008-ce81e047bb7a.gif)

- 💻 **Workspaces** - disposable, fully-configured development environments powered by [Firecracker](https://github.com/firecracker-microvm/firecracker) micro VMs, defined as code.
- 🏗️ **Prebuilds** - Hocus continuously builds your project like a CI system, so you can spin up a fresh dev environment in seconds and focus on coding rather than waiting.
- 🤝 **Project Environment Variables** - Declare shared environment variables for your entire team, making collaboration easier.
- 🔗 **VSCode Integration** - Connect to workspaces over SSH automatically with your local VSCode editor.
- 🧙‍♂️ **Full Root Access** - Unlike Docker containers, Hocus workspaces are full-fledged VMs, giving you full control over your environment. You can use Docker and nested KVM, run [LocalStack](https://github.com/localstack/localstack), or even deploy [Kubernetes](https://github.com/kubernetes/kubernetes);
- 🔄 **Support for any Git provider that uses the SSH protocol** - Connect Hocus to Github, Gitlab, Bitbucket, Gitea, Gerrit, and others.
- 🚄 **Monorepo support** - Create multiple development environments for different projects in a single repository.

## Get Started

### Requirements

- x86_64 Linux
- KVM support on the host
- Git and Git LFS
- Docker, Docker Compose, and Buildx

That's it! Hocus is fully containerized and won't install anything directly on your host system. The following script will check if your system meets the requirements, prompt you to install any missing dependencies, and set up Hocus with `docker-compose`.

```bash
git clone https://github.com/hocus-dev/hocus.git
cd hocus
HOCUS_HOSTNAME="localhost" ops/bin/local-up.sh
```

It will bring up:

- the Hocus control plane, a [Remix](https://github.com/remix-run/remix) application
- [Temporal](https://temporal.io/), which is a workflow engine
- the Hocus agent, which is a Temporal worker
- [Postgres](https://www.postgresql.org/)
- [Keycloak](https://www.keycloak.org/), for authentication

You can run `ops/bin/local-cleanup.sh` to remove Hocus from your system completely. Check out our [quickstart](https://hocus.dev/docs/installation/quickstart) for next steps and more information about managing your deployment.

## Current State of Hocus
- Hocus is currently in **alpha**, but it's already useful for personal use. We are using Hocus to develop Hocus, but we don't recommend you deploy it for your team at work yet.
- Hocus currently supports **single node deployment** only. However, it is designed to be deployed on a fleet of servers in the future.
- While Hocus works well for most scenarios, there are **known bugs** and **rough edges**. For example, stopping a workspace may sometimes leave it in the stopping state indefinitely.
- Despite its imperfections, we're releasing Hocus now to get feedback and learn if others find it useful.

## Project Goals
- **Ease of deployment** and management are central goals of Hocus, with minimal assumptions made about the underlying OS and hardware.
- Hocus should provide a **native development** experience with performance on par with bare-metal development.
- Hocus should be scalable to accommodate **large teams**, with support for thousands of users and heavyweight repositories. We're not there yet.

## Roadmap
- [x] Add basic single node support
- [ ] Optimize single node storage usage, performance, and reliability
- [ ] Add permissioning for teams, admins, and regular users
- [ ] Add multi-node support
- [ ] Add support for more IDEs, particularly JetBrains

## Versioning
While in **alpha**, every version change should be assumed to be **breaking**. There are no upgrade paths.

## License
This repository's code is licensed under the Elastic License v2.0, unless stated otherwise. The `extensions` directory and its subdirectories are licensed under MIT.
