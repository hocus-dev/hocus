#!/bin/bash

rsync -avz -e "ssh -i /tmp/ssh_key" --exclude node_modules --exclude .cache --exclude build . $DEV_MACHINE_USER@$DEV_MACHINE_HOSTNAME:/home/$DEV_MACHINE_USER/dev/hocus
