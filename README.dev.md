# Developer Readme

This is a developer readme. It is not intended for end users.

## Running workflow tests

Inside a hocus workspace run:

```bash
sudo ./ops/bin/dev/run-agent-tests.sh
```

This will build test VM's, attach to the running Hocus agent and start an E2E test suite using https://github.com/hocus-dev/tests
