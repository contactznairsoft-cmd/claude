# Affiches produit ZN Airsoft (gabarit « affiches-zn »)

Reconstruction du gabarit validé (voir `reference/`) pour produire les affiches produit du camion :
photo réelle détourée, nom, prix TTC, référence, 3 badges specs, 3 encarts accessoires.

## Arborescence

| Chemin | Rôle |
|---|---|
| `template.html` | Gabarit HTML/CSS, polices Anton + Oswald locales. Aperçu navigateur : `template.html?data=data/<slug>.json` |
| `export.js` | Rendu Playwright/Chromium : `<slug>_insta.png` (1080×1350) + `<slug>_a4.pdf` (210×297 mm). `4k` en option |
| `concat-pdf.js` | Concatène les A4 en `out/affiches-camion-<date>.pdf` (pdf-lib) |
| `fetch-assets.sh` | Récupère les photos réelles (URLs prod ou scp img/p/) dans `assets/<slug>/` |
| `tools/detourer.js` | Détourage sans IA : fond clair connecté aux bords rendu transparent, rognage. Aucun redessin |
| `tools/export-donnees-camion.sh` | Export CSV MySQL à lancer sur le serveur OVH (stock Camion, ventes 90 j, prix, specs, accessoires) |
| `data/<slug>.json` | Une fiche par affiche (voir format ci-dessous) |
| `assets/<slug>/` | `cover.png`, `acc1..3.png` : photos réelles détourées |
| `backgrounds/` | Fonds de marque validés (Evolution circuits, Dracarys braises…). Vide = fond générique ZN |
| `fonts/` | Anton-Regular, Oswald-Variable (OFL) |
| `reference/` | Les 5 affiches validées qui font foi pour le design |

## Utilisation

```bash
npm install                                   # pdf-lib, sharp (Playwright vient de /opt/node22)
./fetch-assets.sh <slug> <url_cover> <url_acc1> <url_acc2> <url_acc3>
node tools/detourer.js --all assets/<slug>    # fond -> transparent
node export.js <slug>                         # insta + A4
node export.js                                # toutes les fiches de data/
node export.js <slug> 4k                      # 4320×5400 (A3 / 4K) à la demande
node concat-pdf.js [ordre.txt]                # PDF global pour l'impression
```

## Format `data/<slug>.json`

```json
{
  "title": "Evolution", "title_accent": "Reaper XS",
  "subtitle": ["Evolution International", "AEG", "Carbontech"],
  "badges": [ { "icon": "chip", "label": "ETS II" }, { "icon": "bbs", "label": "110 billes" }, { "icon": "mlok", "label": "M-LOK" } ],
  "image": "assets/evolution-reaper-xs/cover.png",
  "background": "",                     // ex. "backgrounds/evolution.png"
  "price": 239.90, "price_old": null,   // price_old = prix barré si prix spécifique actif
  "reference": "EC64AR-ETS",
  "accessories": [ { "name": "…", "price": 16.90, "reference": "EA0310M", "image": "assets/…/acc1.png" } ],
  "mention_18": false,                  // true = « Vente interdite aux moins de 18 ans » en pied
  "logo": "assets/logo-zn.png"          // optionnel : logo officiel à la place du texte ZN AIRSOFT
}
```

Icônes de badge disponibles : `crosshair`, `bbs`, `mlok`, `chip`, `battery`, `bolt`, `gas`, `co2`, `eye`, `shield`, `weight`, `ruler`, `fps`, `flame`, `bag`, `star`.

## Règles de la mission

- Aucune donnée inventée : nom, prix TTC, référence, specs et accessoires viennent de la base (`tools/export-donnees-camion.sh`).
- Photos jamais redessinées ni retouchées par IA ; seul le détourage géométrique de `tools/detourer.js` est appliqué.
- Aucune génération IA de fond : fonds validés dans `backgrounds/`, sinon fond générique ZN du gabarit.
- Contrôle qualité avant livraison : `controle-affiches-camion.md` (produit / réf / prix affiché / prix base / photo OK).
