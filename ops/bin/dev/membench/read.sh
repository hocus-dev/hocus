#!/bin/bash

# Directory where the files are stored
directory="logs"

# Array to store individual file hashes
file_hashes=()

# Loop to calculate SHA256 hash for each file
for ((i=1; i<=1000; i++))
do
    # Generate the file path
    filename="${directory}/file${i}.txt"

    # Calculate the SHA256 hash of the file
    hash=$(sha256sum "$filename" | awk '{print $1}')

    # Store the individual file hash in the array
    file_hashes+=("$hash")

    # Print the file path every 50 files
    if (( "$i" % 50 == 0 )); then
        echo "$filename"
    fi
done

# Concatenate and calculate the SHA256 hash of all the individual hashes
concatenated_hash=$(printf "%s" "${file_hashes[@]}" | sha256sum | awk '{print $1}')

echo "Concatenated Hash: $concatenated_hash"
