#!/bin/sh
# Fails when an assistant or documentation file exceeds its size limit (docs/ai-rules.md).
status=0
check() {  # limit file...
  limit=$1; shift
  for file; do
    size=$(wc -c < "$file")
    if [ "$size" -gt "$limit" ]; then
      echo "$file: $size bytes, limit $limit" >&2
      status=1
    fi
  done
}
check 3072 CLAUDE.md
check 2048 backend/CLAUDE.md frontend/CLAUDE.md deploy/CLAUDE.md
check 1536 docs/STATE.md
check 5120 docs/*.md
exit $status
