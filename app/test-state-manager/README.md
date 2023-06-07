# Test state manager

Hocus tests rely on global kernel state which needs to be cleaned up after a test run.
If we don't clean up this state then nothing bad will happen, but it will result in a gradual memory leak.
Tests which fail need to always send us debug logs cause otherwise there is no other way to debug problems besides lacing the codebase with `console.logs()` (which was happening way too often and slowed me down a lot).
As of time of writing there is no reliable way to always trigger cleanup in existing JS testing frameworks:
| Cleans up on | JEST | Mocha | Ava |
| ------------- | ---- | ----- | --- |
| Test Timeout | ✅ | ✅ | ❌ |
| Test Failures | ✅ | ✅ | ✅ |
| Uncaught exception | ✅ | ✅ | ❌ |
| Unhandled error | ✅ | ✅ | ❌ |
| process.exit | ❌ | ❌ | ❌ |
| SIGINT/SIGTERM | ❌ | ❌ | ❌ |
| Test OOM | ❌ | ❌ | ❌ |
| Force exit | ❌ | ❌ | ❌ |

The test state manager is an attempt to reliably clean up resources after test runs and to upload debug logs in case of test failures. It works as a separate low memory usage daemon which exposes an IPC RPC via a unix socket for requesting stateful resources which:

- Need to be always cleaned up
- Need to always be part of the debug output in case of test failures

Test runs open an IPC connection to the daemon and at the end of the test run inform the daemon that the test ended along with the result.
The daemon keeps track of the running tests and assumes test failure when:

- The connection between the test and the daemon got severed
- The daemon received SIGINT/SIGTERM/SIGHUP

This way even if the test process got SIGKILL we will be able to clean up resources and upload debug logs.
