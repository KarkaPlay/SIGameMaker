#!/bin/bash
set -euo pipefail

# Finder launches .command files with a different working directory and PATH.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

finish() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    printf '\nСборка не завершена. Причина указана выше.\n'
    printf '\nНажмите Enter, чтобы закрыть это окно…'
    read -r _ || true
  elif [ -t 1 ]; then
    # Let this shell exit first, then close only the Terminal window hosting it.
    /usr/bin/osascript - "$(tty)" >/dev/null 2>&1 <<'APPLESCRIPT' &
on run argv
  set targetTTY to item 1 of argv
  delay 1
  tell application "Terminal"
    repeat with terminalWindow in windows
      repeat with terminalTab in tabs of terminalWindow
        if (tty of terminalTab) is targetTTY then
          close terminalWindow
          return
        end if
      end repeat
    end repeat
  end tell
end run
APPLESCRIPT
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
