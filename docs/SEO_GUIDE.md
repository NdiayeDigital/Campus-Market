# 🚀 Guide & Stratégie SEO : Propulser Campus Market en #1 sur Google

Ce document détaille l'architecture SEO déployée sur **Campus Market** (Université Iba Der Thiam de Thiès - UIDT) ainsi que le plan d'action externe pour dominer la 1ère place des résultats Google (« tout en haut des recherches »).

---

## 1. Architecture SEO Technique Déployée

### 🎯 Méta-Balises Stratégiques & On-Page
* **Balise `<title>` Optimale** :
  `Campus Market — Marketplace Étudiante UIDT Thiès | Livraison en Chambre`
  *Intègre le nom de marque, le statut de marketplace, l'université (UIDT), la ville (Thiès) et la proposition de valeur (livraison en chambre).*
* **Meta Description Incitative (Booster de CTR)** :
  `Campus Market : La 1ère marketplace des étudiants de l'UIDT Thiès. Commandez repas chauds, vêtements, fournitures et accessoires livrés directement dans votre chambre ou pavillon !`
* **Méta Keywords Exhaustive** :
  Mots-clés stratégiques ciblés (marques, requêtes locales, besoins urgents du campus, intentions d'achat et de vente).
* **Directives Robots Strictes** :
  `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1` autorisant Google à afficher des extraits enrichis grand format.
* **Lien Canonique & Balises Hreflang** :
  Protection contre le duplicate content et ciblage linguistique sénégalais (`fr-SN` et `x-default`).
* **Balises de Géolocalisation Local SEO** :
  `geo.region: SN-TH`, `geo.placename: Thiès, Sénégal`, `geo.position: 14.7910;-16.9359`, `ICBM: 14.7910, -16.9359`.

---

## 2. Données Structurées JSON-LD (Schema.org) pour Rich Snippets

Google affiche des encarts enrichis spécifiques qui augmentent drastiquement l'espace visuel sur la SERP (Search Engine Result Page) :

1. **`WebSite` avec `SearchAction` (Sitelinks Searchbox)** :
   Permet à Google d'afficher une barre de recherche directe vers Campus Market directement dans les résultats de recherche.
2. **`ShoppingCenter` / `LocalBusiness`** :
   Ancre Campus Market comme établissement commercial officiel de l'UIDT Thiès, avec devises acceptées (XOF), modes de paiement (Cash, Wave, Orange Money) et horaires 7j/7.
3. **`FAQPage` (Rich Snippets Accordéon Google)** :
   Multiplie par 3 la hauteur de votre résultat dans Google grâce aux questions déroulantes directement cliquables :
   * *Qu'est-ce que Campus Market UIDT ?*
   * *Comment se déroule la livraison dans les pavillons ?*
   * *Quels modes de paiement sont acceptés ?*
   * *Comment un étudiant peut-il vendre ses produits ?*
4. **`BreadcrumbList` (Fil d'Ariane Sémantique)** :
   Affiche l'arborescence propre `Accueil > Catalogue UIDT > Espace Vendeur`.

---

## 3. SEO Crawlable Fallback & Indexabilité SPA

Les Single Page Applications (Vite / React / Vue) souffrent traditionnellement d'un contenu initial vide (`<div id="app"></div>`).

* **Pré-rendu sémantique HTML** :
  Un contenu HTML complet et accessible est injecté au chargement :
  * Balise principale `<h1>` contenant les mots-clés prioritaires.
  * Grille des catégories (Restauration & Thiéboudienne, Mode & Friperie, Fournitures, Informatique).
  * Liste des pavillons desservis (Pavillons A, B, C, D, Campus VDN, Cité Universitaire Thiès).
  * FAQ sémantique.
* **Hydratation Client Transparente** :
  Dès que JavaScript s'exécute, l'application interactive prend le relais sans aucun flash visuel.
* **Support `<noscript>`** :
  Permet aux bots restreints en bande passante ou moteurs sans exécution JS de capturer 100% de la pertinence sémantique.

---

## 4. Gestion Dynamique du SEO (`src/utils/seo.js`)

À chaque navigation ou recherche dans la Web App, les métadonnées sont synchronisées dynamiquement :

* **Recherche** : Titre adapté automatiquement `Recherche "{requête}" — Campus Market UIDT`.
* **Fiche Produit** : Titre et description dynamiques avec nom du produit, prix en FCFA et visuel OpenGraph.
* **Vitrine Marchande** : Titre avec le nom de la boutique de l'étudiant.
* **Espace Vendeur & Suivi** : Métadonnées optimisées pour convertir les étudiants-entrepreneurs.

---

## 5. Fichiers de Découverte & Indexation Moteurs

* **`public/robots.txt`** :
  Autorise l'exploration complète, protège les routes privées (`/admin`, `/api/`) et référence l'URL du plan de site XML.
* **`public/sitemap.xml`** :
  Plan de site conforme au protocole Sitemaps.org 0.9 avec priorités et fréquences de mise à jour.
* **`vercel.json`** :
  En-têtes HTTP avec `Cache-Control` et types MIME `text/plain` et `application/xml` pour une mise en cache optimale par les crawlers.

---

## 6. Plan d'Action Externe pour Atteindre la 1ère Place sur Google

Le référencement technique est indispensable, mais Google attribue la position #1 en combinant **pertinence technique**, **SEO local** et **autorité de domaine (backlinks)**. Voici les étapes à déployer :

### Étape 1 : Enregistrement sur Google Search Console (Immédiat)
1. Rendez-vous sur [Google Search Console](https://search.google.com/search-console).
2. Ajoutez votre domaine `https://campusmarket-uidt.com`.
3. Validez la propriété (via balise HTML ou enregistrement DNS TXT chez votre hébergeur).
4. Soumettez l'URL du sitemap : `https://campusmarket-uidt.com/sitemap.xml`.
5. Utilisez l'outil **« Inspection de l'URL »** sur la page d'accueil et cliquez sur **« Demander une indexation »** pour forcer Googlebot à passer sous 24 à 48 heures.

### Étape 2 : Créer la Fiche Google My Business / Google Maps (Dominance Mobile)
Sur smartphone, lors d'une recherche « marketplace UIDT » ou « livraison Thiès », Google affiche en premier le **pack local Google Maps** :
1. Créez une fiche sur [Google Business Profile](https://www.google.com/business/).
2. Nom : `Campus Market - Marketplace UIDT Thiès`.
3. Catégorie : *Service de livraison de repas / Centre commercial / Commerce en ligne*.
4. Adresse : *Université Iba Der Thiam, Thiès, Sénégal*.
5. Lien vers le site web : `https://campusmarket-uidt.com`.
6. Ajoutez des photos du logo, de captures d'écran et des photos de livraison sur le campus.

### Étape 3 : Netlinking & Autorité Campus (Les Meilleurs Backlinks)
Google privilégie les sites recevant des liens de sites universitaires et d'associations :
1. **Lien depuis le site universitaire** : Sollicitez une mention ou un article sur `univ-thies.sn` ou les blogs des amicales de facultés (UFR SES, UFR Santé, etc.).
2. **Réseaux sociaux & Groupes Étudiants** :
   * Ajoutez le lien `campusmarket-uidt.com` dans la bio Instagram, TikTok, LinkedIn et les profils Facebook des étudiants et de la marque.
   * Partagez des liens de produits (`campusmarket-uidt.com/#product/id`) dans les groupes WhatsApp d'étudiants (les prévisualisations OpenGraph et Twitter Cards sont désormais parfaites).
3. **Avis Google** : Encouragez les premiers clients satisfaits à laisser un avis 5 étoiles sur la fiche Google Maps.
