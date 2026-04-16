#!/bin/bash

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE" | xargs)  # trim whitespace

MIN_LENGTH=15
MSG_LENGTH=${#COMMIT_MSG}

if [ "$MSG_LENGTH" -lt "$MIN_LENGTH" ]; then
  echo "❌ Commit message too short ($MSG_LENGTH characters)."
  echo "🔒 Minimum required is $MIN_LENGTH characters."
  echo "👉 Please write a more meaningful message."
  exit 1
fi

exit 0