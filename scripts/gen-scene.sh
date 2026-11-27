#!/bin/zsh
# Make one card picture with OpenAI images, in the porcelain-and-glass style of the existing scenes.
# The API key is read from OPENAI_API_KEY in this repo's .env (git-ignored) and never printed or put on a command line.
#
# Usage: gen-scene.sh <out.png> <prompt-file> [reference.jpg ...]
#   With reference images it uses the edit endpoint, so the new picture matches their style.
set -euo pipefail
out=$1 prompt=$2; shift 2
env=${0:A:h:h}/.env
key=$(sed -n 's/^OPENAI_API_KEY=//p' "$env" 2>/dev/null | tr -d '"'"'"'\r ' | head -1)
[[ -n $key ]] || { echo "No OPENAI_API_KEY in $env" >&2; exit 1; }
model=${OPENAI_IMAGE_MODEL:-gpt-image-2.5-sunburst}
tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT
refs=(); for r in "$@"; do refs+=(-F "image[]=@$r"); done
url=https://api.openai.com/v1/images/generations; (( $# )) && url=https://api.openai.com/v1/images/edits
# The header comes from stdin (-H @-), so the key is not visible in the process list or in any error message.
if (( $# )); then
  printf 'Authorization: Bearer %s\n' "$key" | curl -sS -H @- -o "$tmp" "$url" -F "model=$model" -F "prompt=<$prompt" "${refs[@]}" -F size=1536x1024 -F quality=high
else
  printf 'Authorization: Bearer %s\n' "$key" | curl -sS -H @- -o "$tmp" "$url" -H 'Content-Type: application/json' \
    -d "$(python3 -c 'import json,sys;print(json.dumps({"model":sys.argv[1],"prompt":open(sys.argv[2]).read(),"size":"1536x1024","quality":"high"}))' "$model" "$prompt")"
fi
unset key
python3 - "$tmp" "$out" <<'E'
import json,sys,base64
d=json.load(open(sys.argv[1]))
if 'data' not in d: sys.exit('OpenAI error: '+json.dumps(d.get('error',d))[:300])
open(sys.argv[2],'wb').write(base64.b64decode(d['data'][0]['b64_json'])); print('saved',sys.argv[2])
E
