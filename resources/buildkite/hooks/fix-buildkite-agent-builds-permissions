#!/bin/bash

# To run the unit tests for this file, run the following command in the root of
# the project:
# $ docker-compose -f docker-compose.unit-tests.yml run unit-tests

# Files that are created by Docker containers end up with strange user and
# group ids, usually 0 (root). Docker namespacing will one day save us, but it
# can only map a single docker user id to a given user id (not any docker user
# id to a single system user id).
#
# Until we can map any old user id back to
# buildkite-agent automatically with Docker, then we just need to fix the
# permissions manually before each build runs so git clean can work as
# expected.

set -eu -o pipefail

# We need to scope the next bit to only the currently running agent dir and
# pipeline, but we also need to control security and make sure arbitrary folders
# can't be chmoded.
#
# We prepare the agent build directory basename in the environment hook and pass
# it as the first argument, org name as second argument, and the pipeline dir as
# the third.
#
# In here we need to check that they both don't contain slashes or contain a
# traversal component.

AGENT_DIR="$1"
# => "my-agent-1"

ORG_DIR="$2"
# => "my-org"

PIPELINE_DIR="$3"
# => "my-pipeline"

# Make sure it doesn't contain any slashes by substituting slashes with nothing
# and making sure it doesn't change
function exit_if_contains_slashes() {
	if [[ "${1//\//}" != "${1}" ]]; then
		exit 1
	fi
}

function exit_if_contains_traversal() {
	if [[ "${1}" == "." || "${1}" == ".." ]]; then
		exit 2
	fi
}

function exit_if_blank() {
	if [[ -z "${1}" ]]; then
		exit 3
	fi
}

# Check them for slashes
exit_if_contains_slashes "${AGENT_DIR}"
exit_if_contains_slashes "${ORG_DIR}"
exit_if_contains_slashes "${PIPELINE_DIR}"

# Check them for traversals
exit_if_contains_traversal "${AGENT_DIR}"
exit_if_contains_traversal "${ORG_DIR}"
exit_if_contains_traversal "${PIPELINE_DIR}"

# Check them for blank values
exit_if_blank "${AGENT_DIR}"
exit_if_blank "${ORG_DIR}"
exit_if_blank "${PIPELINE_DIR}"

# If we make it here, we're safe to go!

# We know the builds path:
BUILDS_PATH="/var/lib/buildkite-agent/builds"

# And now we can reconstruct the full agent builds path:
PIPELINE_PATH="${BUILDS_PATH}/${AGENT_DIR}/${ORG_DIR}/${PIPELINE_DIR}"
# => "/var/lib/buildkite-agent/builds/my-agent-1/my-org/my-pipeline"

if [[ -e "${PIPELINE_PATH}" ]]; then
	/bin/chown -R buildkite-agent:buildkite-agent "${PIPELINE_PATH}"
fi
