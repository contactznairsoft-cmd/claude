#!/usr/bin/env bash
# Récupère les photos réelles des fiches (jamais retouchées) dans assets/<slug>/.
# Deux sources possibles :
#   1. URLs prod : fetch-assets.sh <slug> <url_couverture> [url_acc1 url_acc2 url_acc3]
#   2. scp depuis le serveur : SCP_HOST=user@37.187.194.111 SCP_ROOT=/var/www/zn/img/p fetch-assets.sh --scp <slug> <id_image_couverture> [id_acc1 id_acc2 id_acc3]
# Les chemins img/p/ suivent la convention PrestaShop : id 12345 -> 1/2/3/4/5/12345.jpg
set -euo pipefail
cd "$(dirname "$0")"

img_path() { local id="$1"; local p=""; for ((i=0;i<${#id};i++)); do p+="${id:$i:1}/"; done; echo "${p}${id}.jpg"; }

if [[ "${1:-}" == "--scp" ]]; then
  shift; slug="$1"; shift
  : "${SCP_HOST:?SCP_HOST requis (user@37.187.194.111)}"; : "${SCP_ROOT:?SCP_ROOT requis (chemin img/p sur le serveur)}"
  mkdir -p "assets/$slug"
  names=(cover acc1 acc2 acc3); i=0
  for id in "$@"; do
    scp -q "$SCP_HOST:$SCP_ROOT/$(img_path "$id")" "assets/$slug/${names[$i]}.jpg" && echo "assets/$slug/${names[$i]}.jpg <- id_image $id"
    i=$((i+1))
  done
else
  slug="$1"; shift
  mkdir -p "assets/$slug"
  names=(cover acc1 acc2 acc3); i=0
  for url in "$@"; do
    ext="${url##*.}"; ext="${ext%%\?*}"; [[ ${#ext} -gt 4 ]] && ext=jpg
    curl -sSfL -A "Mozilla/5.0" -o "assets/$slug/${names[$i]}.$ext" "$url" && echo "assets/$slug/${names[$i]}.$ext <- $url"
    i=$((i+1))
  done
fi
