#!/bin/bash

if [[ "${1-}" =~ ^-*h(elp)?$ ]]; then
    echo 'Usage: ops/bin/console.sh <VM_ID>

Connects to the console of a VM.

'
    exit
fi

VM_ID=$1
if [ -z "$VM_ID" ]; then
  echo "VM_ID is empty"
  exit 1
fi

stty_orig=`stty -g`
stty -echo # does not print the characters typed
stty -icanon # does not wait for a newline before sending input to cat
tail -s 0.02 -f "/tmp/$VM_ID.log" &
TAIL_PID=$!

clean_up() {
  stty $stty_orig
  kill $TAIL_PID > /dev/null 2>&1
}
trap clean_up INT TERM EXIT

# socat -t 99999999 - OPEN:"/tmp/$VM_ID.stdin",append
cat - > "/tmp/$VM_ID.stdin"
