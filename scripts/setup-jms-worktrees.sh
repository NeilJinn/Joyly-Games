#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

base_branch="${BASE_BRANCH:-jms/architecture-orchestrator}"
worktree_root="${WORKTREE_ROOT:-../jms-worktrees}"

branches=(
  "jms/architecture-orchestrator"
  "jms/m1-motion-core"
  "jms/m2-playground"
  "jms/m3-presentation-modules"
  "jms/m4-theme-adapter"
  "jms/m5-advanced-fx"
)

paths=(
  "."
  "${worktree_root}/m1-motion-core"
  "${worktree_root}/m2-playground"
  "${worktree_root}/m3-presentation-modules"
  "${worktree_root}/m4-theme-adapter"
  "${worktree_root}/m5-advanced-fx"
)

if ! git rev-parse --verify "$base_branch" >/dev/null 2>&1; then
  git branch "$base_branch"
fi

git switch "$base_branch"

mkdir -p "$worktree_root"

for i in "${!branches[@]}"; do
  branch="${branches[$i]}"
  path="${paths[$i]}"

  if [[ "$branch" == "$base_branch" ]]; then
    continue
  fi

  if git rev-parse --verify "$branch" >/dev/null 2>&1; then
    if [[ -d "$path" ]]; then
      continue
    fi
    git worktree add "$path" "$branch"
  else
    git worktree add -b "$branch" "$path" "$base_branch"
  fi
done

printf 'Worktrees ready under %s\n' "$worktree_root"

