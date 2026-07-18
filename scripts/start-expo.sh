#!/bin/sh
set -e

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$APP_DIR"

export EXPO_NO_DOCTOR=1
export EXPO_NO_DEVTOOLS=1

if [ "$#" -eq 0 ]; then
  exec node ./node_modules/expo/bin/cli start --localhost --port 8081
fi

exec node ./node_modules/expo/bin/cli start "$@"
