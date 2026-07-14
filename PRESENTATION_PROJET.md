# Campus Market - Présentation du Projet

## 1. Contexte et Constat avant création
Au sein de l'Université Iba Der Thiam (UIDT), un grand nombre d'étudiants mènent des activités entrepreneuriales pour subvenir à leurs besoins (restauration rapide, vente de clés USB, de fascicules, de vêtements ou de services divers). 
Cependant, avant la création de **Campus Market**, le constat était clair :
- **Désorganisation** : Les ventes se faisaient exclusivement via des groupes WhatsApp. Ces groupes étaient saturés de messages, rendant la visibilité des produits presque nulle au bout de quelques minutes.
- **Friction à l'achat** : Un étudiant ayant faim le soir dans son pavillon devait faire défiler des centaines de messages WhatsApp pour trouver quelqu'un qui préparait à manger.
- **Manque de confiance** : Aucune garantie sur la disponibilité des produits, et aucun suivi des commandes. L'expérience d'achat était artisanale et laborieuse.

## 2. Analyse du Besoin
Face à ce constat, l'analyse a mis en évidence le besoin d'un **tiers de confiance numérique**. 
Il fallait un système qui centralise l'offre et la demande de l'université sans friction logicielle. 
- **La contrainte matérielle** : Les étudiants ont des smartphones souvent limités en espace de stockage. Ils ne téléchargeraient pas une application lourde.
- **La solution technique choisie** : Une **Progressive Web App (PWA)** sous forme de **Single Page Application (SPA)**. L'application se charge instantanément via un simple lien web, fonctionne hors-ligne grâce au cache, et peut être ajoutée à l'écran d'accueil du téléphone sans passer par le Play Store. L'infrastructure repose sur **Supabase**, garantissant une sécurité de niveau entreprise pour protéger les données personnelles des étudiants.

## 3. La Solution : Campus Market
**Campus Market** est la première marketplace 100% pensée pour et par les étudiants de l'UIDT. 
C'est une plateforme d'e-commerce de proximité ("Pavillon-à-Pavillon").

Le système a été conçu pour reproduire les standards des géants de la livraison (comme Jumia ou UberEats) tout en les adaptant à la réalité étudiante. 
Le flux d'achat (Workflow) est totalement sécurisé et transparent :
1. **Commande** : Le client commande (statut "En attente").
2. **Préparation** : Le vendeur accepte et prépare.
3. **Expédition** : Le vendeur indique que la commande est "En route".
4. **Validation** : Le client confirme la bonne réception de la commande, clôturant ainsi la transaction.

## 4. Les Bénéfices pour les Étudiants Entrepreneurs (Vendeurs)
Campus Market est un véritable accélérateur d'entrepreneuriat étudiant :
- **Visibilité permanente** : Leurs produits sont catalogués et toujours visibles, fini le spam dans les groupes WhatsApp.
- **Gestion professionnelle** : Ils disposent d'un tableau de bord de vendeur professionnel pour suivre leurs revenus, le nombre de ventes et l'état de leurs commandes.
- **Crédibilité** : Vendre via une plateforme structurée augmente la confiance des clients et justifie potentiellement des prix plus rémunérateurs.

## 5. Les Bénéfices pour les Acheteurs (Clients)
Pour l'étudiant consommateur, la plateforme apporte confort et sécurité :
- **Recherche centralisée** : Besoin d'un dîner à 22h ou d'un cahier ? Tout est trié par catégories, avec une recherche intelligente tolérant les fautes de frappe.
- **Livraison au lit** : Lors de la commande, le client précise directement son numéro de pavillon et de chambre.
- **Suivi en temps réel** : Historique des commandes clair et suivi précis ("En préparation", "En route"), éliminant le besoin d'appeler le vendeur pour savoir où en est la commande.

## Conclusion
Campus Market n'est pas qu'un simple projet informatique ; c'est un levier de développement économique local au sein du campus. En structurant les échanges commerciaux de l'université, la plateforme facilite la vie des acheteurs tout en offrant aux étudiants entrepreneurs les outils numériques nécessaires pour développer leur activité de manière professionnelle.
