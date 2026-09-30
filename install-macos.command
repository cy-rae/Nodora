#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is missing. Install it from https://www.python.org/downloads/macos/ or with Homebrew."
  printf "\nPress Enter to close."
  read -r _
  exit 1
fi

python3 "$SCRIPT_DIR/mindmap_manager.py"
printf "\nPress Enter to close."
read -r _
