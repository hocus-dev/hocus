# Developer README

Developer README. Not intended for end users.

## Running workflow tests

Inside a hocus workspace run:

```bash
sudo ./ops/bin/dev/run-agent-tests.sh
```

You can set the following environment variable before running jest to see performance tracing:

```bash
PERF_MONITORING_ENABLED=1
```

This builds test virtual machines, attaches to the running Hocus agent, and starts an E2E test suite using https://github.com/hocus-dev/tests

You may also attach to the agent container manually. The following runs a single E2E test of the prebuild workflow:

```bash
yarn jest 'app/agent/workflows.test.ts' -t 'runBuildfsAndPrebuilds' --testTimeout 600000
```

## Add another BuildKite runner

```bash
cp resources/buildkite/buildkite-agent.cfg.example resources/buildkite/buildkite-agent.cfg
# Change what you need in buildkite-agent.cfg
vim resources/buildkite/buildkite-agent.cfg
# This will build a new VM based on resources/docker/buildkite-agent.Dockerfile and start it in qemu.
# 80% of host memory is passed to the VM as a balloon device with free page reporting enabled :)
# Half of the host cores are passed to the VM
sudo ./ops/bin/dev/run-buildkite.sh
```

## Running Hocus locally with an init configuration

Init configuration is a YAML file that defines users, projects, and repositories that Hocus creates when it starts.
It gets continuously updated by the control plane as users create new entities. Here's how to enable it.

First, create a directory for the init configuration:

```bash
INIT_CONFIG_DIR_PATH="$(pwd)/hocus-init"
mkdir -p "$INIT_CONFIG_DIR_PATH"
```

Hocus will create a file called `config.yaml` in this directory.

Then start Hocus with the environment variable `INIT_CONFIG_DIR_PATH`. Make sure it's an absolute path.

```bash
INIT_CONFIG_DIR_PATH="$INIT_CONFIG_DIR_PATH" HOCUS_HOSTNAME="localhost" ops/bin/local-up.sh
```
