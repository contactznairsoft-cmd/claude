#!/usr/bin/env bash
# Export des données nécessaires à la sélection des 34 affiches « camion ».
# À lancer SUR le serveur OVH (37.187.194.111) via SSH, jamais depuis le back office.
#   ssh user@37.187.194.111 'bash -s' < tools/export-donnees-camion.sh
# Sortie : dossier export-camion/ avec des CSV (séparateur ;) à copier dans le dépôt.
set -euo pipefail

: "${DB_NAME:?DB_NAME requis}"      # ex. export DB_NAME=... DB_USER=... DB_PASS=...
: "${DB_USER:?DB_USER requis}"
: "${DB_PASS:?DB_PASS requis}"
PFX="${DB_PREFIX:-pre2156_}"
SINCE="${SINCE:-2026-06-20}"        # 90 jours avant le 18/09/2026, date en dur
OUT="${OUT:-export-camion}"
mkdir -p "$OUT"

q() { mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" --batch --raw -e "$1" | sed 's/\t/;/g' > "$OUT/$2"; echo "-> $OUT/$2 ($(($(wc -l < "$OUT/$2")-1)) lignes)"; }

# 1a. Tables du module Emplacements (stock Camion)
q "SHOW TABLES LIKE '${PFX}znempl%';" tables_emplacements.csv
for t in $(tail -n +2 "$OUT/tables_emplacements.csv"); do
  q "SELECT * FROM \`$t\`;" "$t.csv"
done

# 1b. Ventes nettes 90 j par produit (site + caisse, retours/avoirs déduits)
q "SELECT od.product_id, od.product_reference, od.product_name,
      SUM(od.product_quantity) AS qte_vendue,
      IFNULL((SELECT SUM(osd.product_quantity) FROM ${PFX}order_slip_detail osd
              JOIN ${PFX}order_detail od2 ON od2.id_order_detail = osd.id_order_detail
              JOIN ${PFX}order_slip os ON os.id_order_slip = osd.id_order_slip
              WHERE od2.product_id = od.product_id AND os.date_add >= '$SINCE'),0) AS qte_retour,
      COUNT(DISTINCT o.id_order) AS nb_commandes, o.module
   FROM ${PFX}order_detail od
   JOIN ${PFX}orders o ON o.id_order = od.id_order
   WHERE o.date_add >= '$SINCE' AND o.valid = 1
   GROUP BY od.product_id, o.module ORDER BY qte_vendue DESC;" ventes_90j.csv

# 1e. Produits actifs, prix TTC réel, prix spécifique actif, stock, image de couverture
q "SELECT p.id_product, p.reference, pl.name, p.active, p.price AS prix_ht,
      ROUND(p.price * (1 + t.rate/100), 2) AS prix_ttc,
      sp.reduction, sp.reduction_type, sp.price AS sp_prix_fixe, sp.from, sp.to,
      sa.quantity AS stock_total, m.name AS fabricant, c.name AS categorie_defaut,
      i.id_image AS id_image_cover, pl.link_rewrite
   FROM ${PFX}product p
   JOIN ${PFX}product_lang pl ON pl.id_product = p.id_product AND pl.id_lang = 1 AND pl.id_shop = 1
   LEFT JOIN ${PFX}tax_rule tr ON tr.id_tax_rules_group = p.id_tax_rules_group AND tr.id_country = 8
   LEFT JOIN ${PFX}tax t ON t.id_tax = tr.id_tax
   LEFT JOIN ${PFX}specific_price sp ON sp.id_product = p.id_product AND sp.id_product_attribute = 0
        AND (sp.from = '0000-00-00 00:00:00' OR sp.from <= NOW()) AND (sp.to = '0000-00-00 00:00:00' OR sp.to >= NOW())
   LEFT JOIN ${PFX}stock_available sa ON sa.id_product = p.id_product AND sa.id_product_attribute = 0
   LEFT JOIN ${PFX}manufacturer m ON m.id_manufacturer = p.id_manufacturer
   LEFT JOIN ${PFX}category_lang c ON c.id_category = p.id_category_default AND c.id_lang = 1 AND c.id_shop = 1
   LEFT JOIN ${PFX}image i ON i.id_product = p.id_product AND i.cover = 1
   WHERE p.active = 1 AND IFNULL(sa.quantity,0) > 0
   ORDER BY p.id_product;" produits_actifs.csv

# 3. Caractéristiques (badges specs) et accessoires déclarés sur les fiches
q "SELECT fp.id_product, fl.name AS caracteristique, fvl.value
   FROM ${PFX}feature_product fp
   JOIN ${PFX}feature_lang fl ON fl.id_feature = fp.id_feature AND fl.id_lang = 1
   JOIN ${PFX}feature_value_lang fvl ON fvl.id_feature_value = fp.id_feature_value AND fvl.id_lang = 1
   ORDER BY fp.id_product;" caracteristiques.csv
q "SELECT a.id_product_1 AS id_product, a.id_product_2 AS id_accessoire
   FROM ${PFX}accessory a;" accessoires.csv
q "SELECT id_image, id_product, cover, position FROM ${PFX}image ORDER BY id_product, position;" images.csv

echo "Terminé. Copier $OUT/ dans le dépôt (data/source/) puis relancer la mission."
