#!/bin/bash

rsync -avz -e "ssh -i /tmp/ssh_key -o StrictHostKeyChecking=no" --exclude node_modules --exclude .cache --exclude build --exclude resources/fs . $DEV_MACHINE_USER@$DEV_MACHINE_HOSTNAME:/home/$DEV_MACHINE_USER/dev/hocus
