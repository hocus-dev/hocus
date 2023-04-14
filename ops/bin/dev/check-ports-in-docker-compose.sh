#!/bin/bash
# Lint step for the CI
# Checks if all ports in all docker-compose files in the repo 
# have the ability to hide their ports by setting NO_EXPOSE_PORTS in the environment

# Assume that any file which has a line starting with services is probably a docker-compose file :P
OUT=$(grep --exclude-dir=node_modules -rl "^services:" . \
 | xargs yq -N '.services.[].ports.[] | filename + ":" + line + " \033[31m" + . + "\033[0m"' \
 | grep -Ev 'NO_EXPOSE_PORTS| [0-9]+$')
STATUS=$?
if [ $STATUS -eq 0 ]; then
  echo -e "\033[31mERROR!\033[0m"
  echo "Due to https://github.com/docker/compose/issues/10462 and https://github.com/docker/compose/issues/3729#issuecomment-394979760"
  echo "We require the NO_EXPOSE_PORTS environment variable to hide all exposed ports from the host"
  echo "We found those occurrences of ports which don't conform to this environment variable:"
  echo -e "$OUT";
  echo "Please fix them, for ex if you want to expose port 5432 then you should expose it in this way:"
  echo -e "\033[32m  - \"\${NO_EXPOSE_PORTS-5432:}5432\"\033[0m"
  echo "Otherwise you might get conflicts when using docker-compose to run tests in CI"
  exit 1
else
  echo -e "\033[32mGood Job!\033[0m No rouge ports found"
fi
