#!/bin/bash

if grep -rnwE "SELECT \*" ./src; then
  echo "🚫 SELECT * is not allowed. Please fetch only required fields."
  exit 1
fi

if grep -rnwE "find\(\)|findAll\(\)" ./src | grep -vE "attributes|select"; then
  echo "🚫 Mongo/Sequelize query missing field selection. Use 'select' or 'attributes'."
  exit 1
fi

exit 0