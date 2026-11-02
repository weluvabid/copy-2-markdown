#!/bin/sh
set -eu

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a Git worktree; skipping hook installation."
  exit 0
fi

existing_hooks_path="$(git config --get core.hooksPath 2>/dev/null || true)"

if [ -n "$existing_hooks_path" ]; then
  echo "Existing core.hooksPath is set to '$existing_hooks_path'; leaving it unchanged."
  exit 0
fi

git config core.hooksPath .githooks
echo "Git hooks configured: .githooks/"
