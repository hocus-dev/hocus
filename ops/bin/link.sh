#!/bin/bash
set -e

cd app && yarn link && cd .. && yarn link "~"
cd agent && yarn link && cd .. && yarn link "~agent"

