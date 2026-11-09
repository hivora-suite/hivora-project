#!/bin/sh
# Fails on likely secrets. Prints file names only, never the matched value (D16).
#   check-secrets.sh            tracked and new files
#   check-secrets.sh --staged   the index (pre-commit hook)
# Known ceiling: a short pattern list, no entropy analysis; a dedicated scanner replaces it.
pattern='BEGIN [A-Z ]*PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20}|xox[baprs]-[A-Za-z0-9-]{10}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{20}|eyJ[A-Za-z0-9_-]{10,}\.eyJ'
names='(^|/)(\.env(\..*)?|\.hivora|id_(rsa|dsa|ecdsa|ed25519)|.*\.(key|pem))$'

if [ "$1" = "--staged" ]; then
  found=$(git grep -lIE --cached "$pattern")
else
  found=$(git grep -lIE --untracked --exclude-standard "$pattern")
fi
tracked=$(git ls-files | grep -E "$names")

if [ -n "$found$tracked" ]; then
  echo "Possible secrets, nothing printed on purpose:" >&2
  printf '%s\n' $found $tracked >&2
  exit 1
fi
