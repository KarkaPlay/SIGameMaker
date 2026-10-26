
#!/bin/bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "SIGameMaker — публикация Production"
echo ""
echo "Будет опубликована текущая папка cloudflare-upload."
echo "Убедитесь, что эта сборка проверена в Preview."
echo ""
read -r -p "Опубликовать? (y/N): " confirm

if [[ "$confirm" != "y" ]]; then
  echo "Публикация отменена."
  exit 0
fi

"$PROJECT_DIR/node_modules/.bin/wrangler" deploy \
  --config "$PROJECT_DIR/wrangler.jsonc"

echo ""
echo "Production успешно опубликован!"
echo "https://sigamemaker.karkaplay.workers.dev"

read -r -p "Нажмите Enter для закрытия..."
