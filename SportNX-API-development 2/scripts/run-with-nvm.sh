#!/bin/bash

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use
else
  echo "nvm not found. Using system node."
fi

"$@"