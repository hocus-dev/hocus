# Developer Readme

This is a developer readme. It is not intended for end users.

## Running workflow tests

Inside a hocus workspace run:

```bash
sudo ./ops/bin/dev/run-agent-tests.sh
```

You can set the following environment variable before running jest to see performance tracing:

```bash
PERF_MONITORING_ENABLED=1
```

This will build test VM's, attach to the running Hocus agent and start an E2E test suite using https://github.com/hocus-dev/tests

## To add another buildkite runner

```bash
cp resources/docker/buildkite-agent.cfg.example resources/docker/buildkite-agent.cfg
# Change what you need in buildkite-agent.cfg
vim resources/docker/buildkite-agent.cfg
# This will build a new VM based on resources/docker/buildkite-agent.Dockerfile and start it in qemu.
# 80% of host memory is passed to the VM as a balloon device with free page reporting enabled :)
# Half of the host cores are passed to the VM
sudo ./ops/bin/dev/run-buildkite.sh
```
