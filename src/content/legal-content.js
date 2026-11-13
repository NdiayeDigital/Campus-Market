/**
 * Contenu textuel et juridique officiel de Campus Market UIDT.
 * Sources :
 * - Présentation Officielle Campus Market (PPTX)
 * - Règles et Politiques d'Utilisation Campus Market v1 - Novembre 2026 (PDF)
 * - Cadre de conformité CDP Sénégal (Loi n° 2008-12)
 */

export const ABOUT_DATA = {
    badge: "Université Iba Der Thiam de Thiès (UIDT)",
    title: "La 1ère Marketplace des Étudiants de l'UIDT",
    tagline: "Commandez en quelques clics. On vous livre directement dans votre chambre de pavillon.",
    problemStory: {
        title: "Pourquoi Campus Market ?",
        description: "La vie universitaire à l'UIDT est intense : entre les cours magistraux, les TD et les révisions, se déplacer constamment d'un pavillon à l'autre pour trouver un repas chaud, des fournitures ou une polycopie fait perdre un temps précieux.",
        highlight: "En parallèle, de nombreux étudiants talentueux (cuisiniers, créateurs, revendeurs, dépanneurs) manquaient cruellement d'une vitrine visible et centralisée pour proposer leurs articles à toute la communauté du campus.",
        conclusion: "Campus Market a été conçu par et pour les étudiants afin de combler ce vide en créant un pont direct, solidaire et ultra-rapide entre acheteurs et vendeurs de l'UIDT.",
    },
    pillars: [
        {
            icon: "fa-bolt-lightning",
            color: "text-amber-500 bg-amber-500/10",
            title: "Gain de temps record",
            desc: "Livraison de pavillon à pavillon généralement en 15 à 30 minutes après acceptation par le vendeur.",
        },
        {
            icon: "fa-door-open",
            color: "text-primary bg-primary/10",
            title: "Proximité chambre-à-chambre",
            desc: "Remise en main propre directement à votre porte de chambre, que vous soyez au Pavillon A, B ou aux 1000 lits.",
        },
        {
            icon: "fa-hand-holding-heart",
            color: "text-emerald-500 bg-emerald-500/10",
            title: "Économie étudiante solidaire",
            desc: "Favorisez le commerce circulaire du campus en achetant directement auprès d'étudiants entrepreneurs de votre université.",
        },
        {
            icon: "fa-wallet",
            color: "text-indigo-500 bg-indigo-500/10",
            title: "100% Adapté à nos réalités",
            desc: "Règlement souple en Espèces à la livraison ou par transfert direct Wave / Orange Money, sans carte bancaire.",
        },
    ],
    steps: [
        {
            num: "1",
            title: "Je parcours le catalogue",
            desc: "Découvrez les repas du jour, la mode, les polycopies et accessoires proposés par les boutiques étudiantes.",
        },
        {
            num: "2",
            title: "J'indique mon lieu de livraison",
            desc: "Sélectionnez votre pavillon (A, B, C, D, 1000 lits...) et votre numéro de chambre.",
        },
        {
            num: "3",
            title: "Le vendeur prépare la commande",
            desc: "Le marchand étudiant valide immédiatement votre demande et prépare votre colis.",
        },
        {
            num: "4",
            title: "Livraison en 15 à 30 min",
            desc: "Vous êtes livré en chambre et vous payez directement le vendeur en cash ou par Wave.",
        },
    ],
    zones: [
        { name: "Pavillon A", desc: "Campus Social UIDT" },
        { name: "Pavillon B", desc: "Campus Social UIDT" },
        { name: "Pavillon C & D", desc: "Campus Social UIDT" },
        { name: "Résidence 1000 Lits", desc: "Cité Universitaire" },
        { name: "Campus VDN & ENSA", desc: "Espaces d'enseignement" },
        { name: "Résidences Étudiantes Thiès", desc: "Logements partenaires extérieurs" },
    ],
    categories: [
        { name: "Restauration", desc: "Thiéboudienne, fatayas, sandwichs, café Touba, petits déjeuners chauds", icon: "fa-utensils" },
        { name: "Mode & Friperie", desc: "Sneakers, t-shirts, robes, pantalons et accessoires tendance à prix étudiant", icon: "fa-shirt" },
        { name: "Fournitures & Polycopies", desc: "Cahiers, calculatrices scientifiques, fascicules de cours, polycopies", icon: "fa-book" },
        { name: "High-Tech & Dépannage", desc: "Clés USB, écouteurs, chargeurs rapides, câbles, souris et adaptateurs", icon: "fa-laptop" },
        { name: "Beauté & Soins", desc: "Parfums, crèmes hydratantes, soins corporels et hygiène étudiante", icon: "fa-spa" },
    ],
    ambition: {
        title: "Notre ambition pour l'université",
        text: "Faire de Campus Market la plateforme technologique de référence de la vie étudiante à l'Université Iba Der Thiam de Thiès, avant d'étendre ce modèle d'entraide et de dynamisme entrepreneurial aux autres campus universitaires du Sénégal.",
    },
    contact: {
        university: "Université Iba Der Thiam de Thiès (UIDT)",
        location: "Thiès, Sénégal",
        supportEmail: "support@campusmarket-uidt.com",
        assistanceEmail: "assistance@campusmarket-uidt.com",
        website: "www.campusmarket-uidt.com",
    },
};

export const TERMS_DATA = {
    version: "Version 1 · Novembre 2026",
    badge: "Règles Officielles Campus Market",
    charterPoints: [
        "N'avoir qu'un seul compte personnel et garder ses accès strictement secrets.",
        "Fournir des informations réelles et exactes (e-mail universitaire, téléphone, pavillon, chambre).",
        "Ne jamais commander dans sa propre boutique ni arranger de fausses commandes fictives.",
        "Confirmer la réception d'une commande uniquement lorsque les articles ont été réellement reçus.",
        "Rédiger des avis et évaluations honnêtes, constructifs et respectueux de la communauté.",
        "Ne pas chercher à accumuler des points de fidélité ou avantages de manière détournée ou truquée.",
        "Régler directement le vendeur en espèces ou Wave/OM, car Campus Market n'encaisse pas les achats.",
        "Accepter que l'administration contrôle les abus, gèle des privilèges ou suspende un compte en cas de fraude avérée.",
    ],
    sections: [
        {
            id: "objet",
            num: "1",
            title: "Objet et acceptation des règles",
            content: `Campus Market est une plateforme numérique d'intermédiation dédiée à la communauté de l'Université Iba Der Thiam de Thiès (UIDT). Elle met en relation des étudiants vendeurs (repas, vêtements, fournitures, services) et des étudiants acheteurs se faisant livrer dans leur chambre de pavillon.
L'utilisation de la plateforme implique l'acceptation sans réserve des présentes règles, qui constituent le contrat liant chaque utilisateur à Campus Market.`,
        },
        {
            id: "role",
            num: "2",
            title: "Rôle d'intermédiation technique de Campus Market",
            highlight: "Campus Market est un intermédiaire technique et n'est pas vendeur des produits.",
            content: `Campus Market agit en qualité d'intermédiaire technique. Elle n'est ni propriétaire ni revendeur des articles proposés sur la place de marché. Chaque vendeur étudiant est juridiquement et matériellement responsable de ses produits, de l'exactitude de leur description, de leur conformité, de leur hygiène/fraîcheur et de leur remise en main propre.
Campus Market n'encaisse en aucun cas le produit de vos achats : l'acheteur règle directement son vendeur lors de la livraison. Seuls les abonnements marchands (packs vendeurs) sont réglés à l'administration de Campus Market.`,
        },
        {
            id: "compte",
            num: "3",
            title: "Compte étudiant & Vérification d'identité",
            content: `L'accès aux commandes et à la vente est strictement réservé aux membres de l'UIDT.
• Email institutionnel obligatoire : L'inscription nécessite une adresse valide (@univ-thies.sn).
• Validation par code OTP : Un code à 6 chiffres valable 10 minutes est envoyé par e-mail pour certifier chaque nouveau compte.
• Numéro de téléphone sénégalais : Format standard à 9 chiffres (+221).
• Règle d'unicité : Une seule personne physique par compte. La création de multicomptes ou l'usage du compte d'un tiers est formellement interdite.
• E-mail et téléphone verrouillés : Pour prévenir les usurpations d'identité, l'e-mail et le téléphone ne sont pas modifiables directement. Toute modification exceptionnelle nécessite un justificatif auprès du support.`,
        },
        {
            id: "adresses",
            num: "4",
            title: "Lieux et adresses de livraison",
            content: `Les livraisons s'effectuent de pavillon à pavillon. L'étudiant renseigne obligatoirement son pavillon de résidence (Pavillon A, Pavillon B, Pavillon C, 1000 lits, etc.) ainsi que son numéro de chambre.
L'adresse validée au moment de la commande est figée afin d'assurer la traçabilité complète de l'acheminement et d'éviter toute contestation lors de la remise en main propre.`,
        },
        {
            id: "commandes",
            num: "5",
            title: "Règles de commande et de panier",
            content: `• Panier par vendeur : Chaque commande est passée auprès d'un unique marchand afin de garantir un délai de livraison optimal en 15-30 minutes.
• Interdiction d'auto-commande : Il est rigoureusement interdit de passer commande dans sa propre boutique marchande.
• Prévention du spam et des abus : Afin de préserver la disponibilité des vendeurs étudiants, un plafond de 2 commandes journalières par acheteur chez le même marchand est appliqué par le système.`,
        },
        {
            id: "paiement",
            num: "6",
            title: "Modalités de règlement direct (Cash & Wave)",
            content: `Les paiements s'effectuent sans frais d'intermédiaire prélevés sur les achats :
1. En Espèces : Remise en main propre contre le colis lors de l'arrivée du livreur ou du marchand à la porte de la chambre.
2. Par Wave ou Orange Money : Transfert direct au numéro de paiement configuré par le marchand sur sa boutique.
L'acheteur s'engage à disposer du montant exact convenu avant de confirmer sa commande.`,
        },
        {
            id: "livraison",
            num: "7",
            title: "Livraison et remise en main propre",
            content: `Les livraisons sont assurées de chambre à chambre par les vendeurs ou leurs relais sur le campus de l'UIDT. Le délai habituel de livraison est de 15 à 30 minutes après acceptation de la commande.
En cas d'absence imprévue dans sa chambre, l'acheteur est tenu de prévenir le marchand par appel ou WhatsApp au numéro indiqué sur le récapitulatif de commande.`,
        },
        {
            id: "produits-interdits",
            num: "8",
            title: "Produits et contenus strictement interdits",
            alert: "Tolérance zéro : Tout article non conforme entraîne le blocage immédiat de la boutique.",
            content: `Sont formellement bannis de la marketplace :
• Alcool, boissons alcoolisées, spiritueux et dérivés.
• Tabac, cigarettes, chicha, cigarettes électroniques et recharges.
• Substances stupéfiantes, drogues, psychotropes et médicaments soumis à prescription médicale.
• Armes blanches, couteaux, objets contondants ou dangereux.
• Articles contrefaits, copies illégales, matériel piraté ou volé.
• Contenus pornographiques, obscènes, haineux, diffamatoires ou discriminatoires.
• Produits alimentaires avariés, périmés ou préparés dans des conditions d'hygiène manifestement insuffisantes.`,
        },
        {
            id: "vendeurs",
            num: "9",
            title: "Espace Vendeur & Formules marchandes",
            content: `Tout étudiant peut activer sa boutique après validation de son profil par l'administration.
• Formule Découverte : Essai gratuit de 7 jours (jusqu'à 3 articles) pour tester l'engouement du campus sans engagement.
• Formule Pro (1 500 FCFA / mois) : Boutique active, catalogue élargi, statistiques de ventes et visibilité prioritaire.
• Formule Business (2 500 FCFA / mois) : Catalogue illimité, mise en avant Top Shop, badge officiel et support dédié.
Le marchand s'engage à honorer ses commandes avec ponctualité et à maintenir ses stocks à jour.`,
        },
        {
            id: "avis",
            num: "10",
            title: "Évaluations, litiges et médiation",
            content: `Les acheteurs peuvent attribuer une note (1 à 5 étoiles) et rédiger un commentaire après réception de leur commande. Les avis diffamatoires, insultants ou concertés sont automatiquement modérés.
En cas de litige (article non conforme, défaut de livraison), l'administration de Campus Market assure un rôle de médiation impartiale via son centre de support.`,
        },
        {
            id: "sanctions",
            num: "11",
            title: "Sanctions administratives en cas de fraude",
            content: `Tout manquement aux présentes règles expose son auteur aux mesures suivantes :
1. Avertissement formel par e-mail ou WhatsApp.
2. Dépublication temporaire des articles litigieux.
3. Suspension temporaire des droits d'achat ou de vente.
4. Révocation définitive du compte et exclusion de la plateforme en cas de récidive ou de comportement frauduleux caractérisé.`,
        },
        {
            id: "droit",
            num: "12",
            title: "Droit applicable et juridiction",
            content: `Les présentes conditions d'utilisation sont régies par le droit sénégalais. Tout différend relatif à leur validité, interprétation ou exécution sera soumis aux règles de médiation amiable de l'Université Iba Der Thiam avant tout recours contentieux devant les tribunaux compétents de Thiès.`,
        },
    ],
};

export const PRIVACY_DATA = {
    version: "Version 1 · Novembre 2026",
    badge: "Conformité CDP Sénégal (Loi 2008-12)",
    intro: "La protection de votre vie privée et la sécurité de vos informations personnelles sont au cœur des engagements de Campus Market. Nous traitons vos données dans le strict respect de la loi sénégalaise n° 2008-12 du 25 janvier 2008 relative à la protection des données à caractère personnel.",
    keyPrinciples: [
        {
            icon: "fa-shield-halved",
            title: "Zéro Revente de Données",
            desc: "Vos informations ne sont jamais vendues, louées, ni cédées à des annonceurs ou tiers publicitaires.",
        },
        {
            icon: "fa-user-lock",
            title: "Sécurité & Isolation RLS",
            desc: "Vos données sont protégées par le système PostgreSQL Row Level Security (RLS) et des mots de passe hachés.",
        },
        {
            icon: "fa-handshake-angle",
            title: "Partage Strict pour Livraison",
            desc: "Seules les informations indispensables (prénom, téléphone, pavillon, chambre) sont partagées avec le vendeur concerné.",
        },
        {
            icon: "fa-universal-access",
            title: "Maîtrise & Droit à l'Oubli",
            desc: "Vous pouvez demander l'accès, la rectification ou la suppression complète de vos données sur simple demande.",
        },
    ],
    sections: [
        {
            id: "collecte",
            title: "1. Quelles données collectons-nous ?",
            content: `Pour assurer le bon fonctionnement de la marketplace, nous collectons exclusivement les données strictement nécessaires :
• Données d'identité : Prénom, nom de famille, adresse e-mail universitaire officielle (@univ-thies.sn).
• Coordonnées de contact : Numéro de téléphone mobile au format sénégalais (+221).
• Données de livraison campus : Pavillon de résidence et numéro de chambre.
• Données transactionnelles : Historique des commandes passées, montants, modes de paiement choisis (Cash ou Wave/OM) et statut de livraison.
• Informations marchands (pour les vendeurs) : Nom de boutique, description d'activité, logo et numéro de règlement.`,
        },
        {
            id: "finalites",
            title: "2. Pourquoi utilisons-nous vos données ?",
            content: `Vos données personnelles sont traitées pour des finalités précises et légitimes :
1. Acheminement en chambre : Transmettre au vendeur le lieu exact de livraison (pavillon et numéro de chambre) et le numéro d'appel.
2. Certification étudiante : Vérifier par code OTP que chaque utilisateur appartient bien à la communauté universitaire de l'UIDT.
3. Prévention des fraudes : Empêcher les fausses commandes, les usurpations de comptes et le spamming de boutiques.
4. Support et arbitrage : Permettre à l'équipe administrative d'intervenir rapidement en cas de litige sur une commande.
5. Statistiques agrégées : Mesurer l'utilisation globale du service pour améliorer les performances de la plateforme (statistiques totalement anonymisées).`,
        },
        {
            id: "partage",
            title: "3. Avec qui partageons-nous vos informations ?",
            content: `La confidentialité de vos données est absolue :
• Vendeur concerné : Lorsque vous passez commande, seul le marchand sélectionné reçoit votre prénom, votre téléphone et votre adresse de chambre pour effectuer la livraison.
• Prestataires techniques : Nos partenaires d'infrastructure technique (hébergement sécurisé, base de données Supabase avec chiffrement au repos, passerelle d'envoi d'OTP) traitent vos données sous obligation stricte de confidentialité.
• Aucun tiers publicitaire : Nous ne partageons aucune donnée à caractère personnel avec des réseaux publicitaires ou partenaires commerciaux.`,
        },
        {
            id: "securite",
            title: "4. Comment vos données sont-elles protégées ?",
            content: `Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles rigoureuses :
• Hachage robuste des mots de passe : Vos mots de passe ne sont jamais stockés en clair.
• Codes OTP éphémères : Les codes de confirmation e-mail expirent automatiquement après 10 minutes.
• Contrôle d'accès RLS (Row Level Security) : Notre base de données PostgreSQL applique des règles d'accès au niveau de chaque ligne, interdisant formellement à un utilisateur d'accéder aux données privées d'un autre.
• Chiffrement HTTPS / TLS : Toutes les communications entre votre navigateur ou smartphone et nos serveurs sont chiffrées de bout en bout.`,
        },
        {
            id: "conservation",
            title: "5. Durée de conservation des données",
            content: `Vos données sont conservées pendant toute la durée de validité de votre compte étudiant sur Campus Market.
En cas de départ de l'université ou de demande de fermeture de compte, vos données d'identification personnelle sont effacées ou irréversiblement anonymisées dans un délai maximal de 30 jours, sous réserve des obligations légales de conservation des pièces justificatives comptables.`,
        },
        {
            id: "droits",
            title: "6. Vos droits et contact DPO",
            content: `Conformément à la réglementation sénégalaise sur les données à caractère personnel, vous disposez d'un droit permanent d'accès, d'interrogation, de rectification et d'effacement de vos données personnelles.
Pour toute question ou pour exercer vos droits, contactez directement notre équipe :
• Par e-mail : support@campusmarket-uidt.com ou assistance@campusmarket-uidt.com
• Par WhatsApp : via le bouton d'assistance officiel disponible sur la plateforme
• Adresse : Université Iba Der Thiam de Thiès (UIDT), Thiès, Sénégal.`,
        },
    ],
};
