# NodeJS Profiler and Debugger

Run on the host in separate terminals:

```bash
docker exec -it agent bash
# inside the container
socat TCP-LISTEN:4848,fork TCP:127.0.0.1:9229
```

```bash
docker inspect agent | grep IPAddress
docker-compose run --rm node
# inside the container
export IP_ADDRESS="SETME"
export AGENT_PROCESS_PID="SETME"
diat heapprofile -p=$AGENT_PROCESS_PID -a "$IP_ADDRESS:4848"
```

Then in VSCode, go to the Ports tab and forward `$IP_ADDRESS:4848` to localhost:4848. Go to chrome://inspect in your browser, click "Configure" and add localhost:4848. A new remote target should show up. Then click "inspect" on it.
