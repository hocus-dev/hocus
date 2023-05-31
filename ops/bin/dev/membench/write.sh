#!/bin/bash

# Directory to store the files
directory="logs"

# Create the directory if it doesn't exist
mkdir -p "$directory"

# Loop to create 1000 files
for ((i=1; i<=1000; i++))
do
    filename="${directory}/file${i}.txt"

    # Generate 10MB of random data using /dev/urandom
    dd if=/dev/urandom of="$filename" bs=10M count=1 status=none

    if (( "$i" % 50 == 0 )); then
        echo "$filename"
    fi
done
