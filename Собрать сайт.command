#!/bin/bash
set -euo pipefail

# Finder launches .command files with a different working directory and PATH.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

finish() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    printf '\nСборка не завершена. Причина указана выше.\n'
  fi
  if [ -t 0 ]; then
    printf '\nНажмите Enter, чтобы закрыть это окно…'
    read -r _ || true
  fi
}
trap finish EXIT

cd "$PROJECT_DIR"
printf 'SIGameMaker — сборка для Cloudflare\n\n'

if ! command -v node >/dev/null 2>&1; then
  printf 'Не найден Node.js. Установите Node.js 18 или новее и повторите запуск.\n' >&2
  exit 1
fi

node "$PROJECT_DIR/build-cloudflare.mjs"

# Open Finder only during an interactive launch (including double-click).
if [ -t 1 ]; then
  /usr/bin/open "$PROJECT_DIR/cloudflare-upload"
fi
