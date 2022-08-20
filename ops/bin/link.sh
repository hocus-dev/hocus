#!/bin/bash
set -e

cd app && yarn link && cd .. && yarn link "~"

