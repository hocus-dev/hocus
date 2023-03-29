#!/bin/bash

# This script is used during development to clean up the agent storage, mostly ext4 images.

set -o errexit
set -o pipefail
set -o nounset

rm -rf /srv/jailer/resources/project/*
rm -rf /srv/jailer/resources/buildfs/*
rm -rf /srv/jailer/resources/buildfs-drives/*
rm -rf /srv/jailer/resources/repositories/*
rm -rf /srv/jailer/resources/fs/*
rm -rf /srv/jailer/resources/checked-out/*
