# Roadmap : Refonte du Design System & Humanisation de l'Identité Visuelle

> **Statut :** Mis de côté pour traitement ultérieur (Backlog Design).  
> **Objectif :** Éliminer les stéréotypes visuels "générés par IA" de Campus Market pour lui forger une véritable identité de marque ancrée dans l'écosystème étudiant de l'UIDT de Thiès.

---

## 1. Diagnostic des "Tells" IA à corriger

### A. La palette "Tailwind Starter Pack"
- **Actuel :** `#1D4ED8` (Bleu Tailwind standard), `#F8FAFC` (Slate-50), `#F59E0B` (Ambre).
- **Problème :** Esthétique de dashboard B2B / SaaS américain, froid et impersonnel.
- **Piste d'amélioration :**
  - Explorer une palette plus chaleureuse et identitaire :
    - Vert profond ou bleu nuit universitaire.
    - Accents ocre sable ou terre cuite (terracotta) rappelant l'atmosphère de Thiès.
    - Éliminer les dégradés bleu-vers-bleu artificiels.

### B. La typographie générique
- **Actuel :** `Inter` + `Outfit`.
- **Problème :** `Inter` est devenue la voix par défaut des templates IA, sans relief ni émotion.
- **Piste d'amélioration :**
  - Tester des typographies modernes avec une vraie voix éditoriale : *Plus Jakarta Sans*, *Satoshi*, *Syne* ou *Clash Display*.

### C. L'anatomie des boutons
- **Actuel :**
  - Rétrécissement systématique au clic : `active:scale-95 duration-200`.
  - Ombres colorées artificielles : `shadow-primary/25 hover:shadow-primary/40`.
  - Incohérence des rayons de courbure (`rounded-xl` vs `rounded-2xl` vs `rounded-full`).
  - Présence systématique d'icônes à côté de chaque verbe (`🛍️ Commander →`).
- **Piste d'amélioration :**
  - Adopter des aplats de couleur francs et mats.
  - Supprimer les ombres néon et l'effet élastique `scale-95`.
  - Unifier les rayons de courbure sur un standard précis (ex: 8px net ou pillule assumée).
  - Épurer les icônes superflues : laisser la force au texte et à la typographie.

### D. L'accumulation de badges et pastilles
- **Actuel :** Pastilles colorées sur presque tous les blocs (`🔥 Promo`, `📢 Info`, `⚡ Nouveau`, points clignotants).
- **Piste d'amélioration :**
  - Règle de Chanel : supprimer 50 % des badges et micro-icônes.
  - Laisser les photos réelles des marchands et produits occuper le premier rôle.

---

## 2. Plan d'intervention lors de la reprise

1. **Tokens de design (`tailwind.config.js`) :**
   - Redéfinition des couleurs primaires, secondaires et de surface.
   - Sélection et intégration de la nouvelle typographie.
   - Normalisation du système d'arrondis (`border-radius`) et d'élévations (`box-shadow`).

2. **Composants d'action (`Button`) :**
   - Création de classes utilitaires ou d'un composant de bouton standardisé (`btn-primary`, `btn-secondary`, `btn-ghost`).
   - Retrait de `active:scale-95` et des dégradés superflus.

3. **Cartes et fiches produits :**
   - Épuration des badges dans `ProductCard.js` et `ProductDetailModal.js`.
   - Rythme asymétrique plus éditorial sur la page d'accueil.

---

*Document archivé dans le projet pour réouverture au moment opportun.*
