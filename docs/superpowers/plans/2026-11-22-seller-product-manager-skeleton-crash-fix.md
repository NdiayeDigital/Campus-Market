# Plan d'Implémentation : Correction du Blocage sur les Cartes Squelettes dans "Mes Articles"

> **Pour les agents / exécutants :** SOUS-COMPÉTENCE REQUISE : Utiliser `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les étapes utilisent la syntaxe de case à cocher (`- [ ]`).

## Description du Problème

Dans la capture d'écran fournie par l'utilisateur sur `campusmarket-uidt.com/admin#seller/products` :
- Le badge du sous-onglet "Mes Articles" dans la barre latérale affiche bien **5 articles**.
- En revanche, la zone principale reste bloquée avec **3 rectangles gris animés (skeletons de chargement)**, le bouton indique **"Mes Articles 0"** et le quota indique **"Pack Business : 0 / 10 produits 0%"**.

### Cause Racine Identifiée (100% Reproductible)

Dans `src/components/seller/ProductManager.js` :
1. Au montage, `loadData()` initialise `isLoading = true` et effectue un premier `render()` affichant `renderSkeleton()`.
2. `getSellerProducts(sellerId)` récupère bien les 5 produits avec succès.
3. Dans le bloc `finally` de `loadData()`, `isLoading` passe à `false` et `render()` est rappelé pour afficher la liste réelle via `renderProductsListView()`.
4. À la ligne 978 de `ProductManager.js`, dans la boucle de rendu des articles :
   ```javascript
   const isSuperAdminSeller = subStatus?.isSuperAdmin || sellerProfile?.role === 'superadmin';
   ```
   **`subStatus` n'est pas défini dans la fonction `renderProductsListView` !**
   Cela déclenche immédiatement une exception JavaScript fatale :
   `ReferenceError: subStatus is not defined`
5. L'exécution de `render()` s'interrompt brutalement. Le DOM n'est jamais mis à jour et reste figé dans son état initial (les 3 skeletons de chargement et le compteur à 0).

---

## Modifications Proposées

### [Composant Vendeur]
#### [MODIFY] `src/components/seller/ProductManager.js`
- Au début de `renderProductsListView(forSaleCount, soldCount, pausedCount)`, ajouter l'extraction des quotas et du statut d'abonnement :
  ```javascript
  const { subStatus } = getQuotaInfo();
  ```
- Sécuriser l'accès à `subStatus` avec repli sur `sellerProfile` (`const isSuperAdminSeller = subStatus?.isSuperAdmin || sellerProfile?.role === 'superadmin';`).
- Envelopper l'exécution du second `render()` dans un `try/catch` avec affichage d'erreur gracieux pour ne plus jamais bloquer l'interface sur un skeleton infini en cas d'erreur de rendu.

---

## Plan de Vérification

### Tests Automatisés
- Ajouter un test unitaire dans `tests/test-seller-dashboard-products.js` instanciant `createProductManager` avec des produits réels et vérifiant que `renderProductsListView` s'exécute sans lever `ReferenceError: subStatus is not defined`.
- Exécuter la suite complète : `npm test && npm run build`.

### Vérification Manuelle
- L'utilisateur pourra ouvrir `campusmarket-uidt.com/#seller/products` et voir immédiatement la liste de ses 5 articles avec titres, prix, badges de stock et actions au lieu des 3 rectangles gris.
