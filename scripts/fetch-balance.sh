#!/usr/bin/env bash
# Fetch DeepSeek balance from terminal — raw data to compare against app
# Usage: ./scripts/fetch-balance.sh <DEEPSEEK_API_KEY>

set -euo pipefail

API_KEY="${1:-$DEEPSEEK_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "Usage: ./scripts/fetch-balance.sh <DEEPSEEK_API_KEY>"
  echo "   or: DEEPSEEK_API_KEY=sk-xxx ./scripts/fetch-balance.sh"
  exit 1
fi

echo "=== DeepSeek Balance API ==="
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  "https://api.deepseek.com/user/balance")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "Error: HTTP $HTTP_CODE"
  echo "$BODY"
  exit 1
fi

echo "Raw JSON:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

echo ""
echo "=== Parsed ==="

echo "$BODY" | python3 -c "
import json, sys
data = json.load(sys.stdin)
infos = data.get('balance_infos', [])
for info in infos:
    currency = info.get('currency', '?')
    total = float(info.get('total_balance', 0))
    granted = float(info.get('granted_balance', 0))
    topped_up = float(info.get('topped_up_balance', 0))
    symbol = '¥' if currency == 'CNY' else '$'
    print(f'Currency:     {currency}')
    print(f'Total:        {symbol}{total:.4f}')
    print(f'Granted:      {symbol}{granted:.4f}')
    print(f'Topped Up:    {symbol}{topped_up:.4f}')
    print()
"
