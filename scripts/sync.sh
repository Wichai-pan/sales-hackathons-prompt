#!/usr/bin/env bash
# One-command team sync: rebase-pull then push. Use after every memory/ edit.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git pull --rebase
git push
echo "[sync] up to date with remote."
