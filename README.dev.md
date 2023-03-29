# Developer Readme

This is a developer readme. It is not intended for end users.

## Running workflow tests

Attach to the agent container and run:

```bash
yarn jest 'app/agent/workflows.test.ts' -t 'runBuildfsAndPrebuilds' --testTimeout 600000
```
