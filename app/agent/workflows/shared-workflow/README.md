# Lifetime of a shared workflow

Scenario 1: one workflow calls withSharedWorkflow and waits for the result.

```mermaid
sequenceDiagram
    withSharedWorkflow-->>+runSharedWorkflow: signal with start (waitRequestSignal)
    runSharedWorkflow->>+the shared workflow: start child
    the shared workflow->>-runSharedWorkflow: return result
    runSharedWorkflow-->>-withSharedWorkflow: signal result (releaseSignal)
```

Scenario 2. One workflow calls withSharedWorkflow, waits for the result, but gets cancelled before it receives the result.

```mermaid
sequenceDiagram
    participant withSharedWorkflow
    participant external user
    withSharedWorkflow-->>+runSharedWorkflow: signal with start (waitRequestSignal)
    runSharedWorkflow->>+the shared workflow: start child
    external user->>withSharedWorkflow: cancel workflow
    withSharedWorkflow-->>runSharedWorkflow: signal being cancelled (waitRequestSignal)
    Note over withSharedWorkflow: ends
    runSharedWorkflow->>the shared workflow: cancel workflow
    Note over runSharedWorkflow: ends
    Note over the shared workflow: ends

```

Scenario 3. Two workflows call withSharedWorkflow and wait for the result. One of them gets cancelled before it receives the result.

```mermaid
sequenceDiagram
    participant withSharedWorkflow1
    participant withSharedWorkflow2
    participant external user
    withSharedWorkflow1-->>+runSharedWorkflow: signal with start (waitRequestSignal)
    runSharedWorkflow->>+the shared workflow: start child
    withSharedWorkflow2-->>runSharedWorkflow: signal with start (waitRequestSignal)
    external user->>withSharedWorkflow2: cancel workflow
    withSharedWorkflow2-->>runSharedWorkflow: signal being cancelled (waitRequestSignal)
    Note over withSharedWorkflow2: ends
    the shared workflow->>-runSharedWorkflow: return result
    runSharedWorkflow-->>-withSharedWorkflow1: signal result (releaseSignal)
    Note over the shared workflow: ends
    Note over runSharedWorkflow: ends
```
