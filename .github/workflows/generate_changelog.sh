#!/bin/bash

version=$(cat package.json | jq -r '.version')

last_commit_hash=$(git show-ref --tags | head -n1 | cut -f 1 -d " " | tr -d '\n')
last_commit_iso8601=$(git show -s --format="%cI" $last_commit_hash |tail -n 1 | tr -d '\n')
name_with_owner=$(gh repo view --json nameWithOwner -q ".nameWithOwner" | tr -d '\n')
pr_list=$(gh pr list --search "merged:>${last_commit_iso8601}" --repo ${name_with_owner})

mkdir change_notes
echo "# release notes" > change_notes/${version}.md
echo "## version: ${version}" >> change_notes/${version}.md
IFS=$'\n'
for line in $pr_list; do
  ticket=$(echo ${line} | cut -f 1)
  title=$(echo ${line} | cut -f 2)
  echo "- [#${ticket}](https://github.com/${name_with_owner}/pull/${ticket})  ${title}" >> change_notes/${version}.md
done