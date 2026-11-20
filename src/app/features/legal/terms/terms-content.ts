import { COMPANY_NAME, PRODUCT_NAME } from "../../../core/brand";
import { CONTACT } from "../../../core/contact";
import { LegalSection } from "../legal-page/legal-section";

export const TERMS_UPDATED = "Dernière mise à jour : 20 novembre 2026";

export const TERMS_INTRO = `Les règles du jeu, en clair : ce que ${PRODUCT_NAME} vous offre, ce que nous attendons de vous, et comment nous nous quittons si besoin.`;

export const TERMS_SECTIONS: LegalSection[] = [
    {
        id: "objet",
        title: "Objet",
        body: [
            `Ces conditions encadrent l'utilisation de ${PRODUCT_NAME}, logiciel de gestion de boutique (ventes, caisse, stock, clients) édité par ${COMPANY_NAME}. En créant un compte ou en utilisant le service, vous les acceptez.`,
        ],
    },
    {
        id: "compte",
        title: "Compte et accès",
        body: [
            [
                "Vous devez fournir des informations exactes lors de la création de votre boutique.",
                "Vous êtes responsable de la confidentialité de votre mot de passe et de l'activité de votre compte.",
                "L'administrateur d'une boutique peut créer des comptes pour ses employés et en choisir les droits ; il reste responsable de leur usage.",
            ],
            "Prévenez-nous rapidement si vous pensez que votre compte a été utilisé sans votre accord.",
            [
                "À l'inscription, un code envoyé par e-mail confirme que l'adresse vous appartient.",
                "Après 5 mots de passe faux d'affilée, le compte est bloqué 15 minutes pour le protéger.",
                "Une session reste ouverte 30 jours sur un appareil, puis il faut se reconnecter. La déconnexion la ferme tout de suite.",
            ],
        ],
    },
    {
        id: "essai",
        title: "Essai gratuit",
        body: [
            `${PRODUCT_NAME} est proposé avec une période d'essai gratuite, pendant laquelle toutes les fonctionnalités sont disponibles. Sa durée est indiquée dans la page Abonnement de l'application.`,
            [
                "Nous vous prévenons 7 jours puis 1 jour avant la fin, par e-mail et dans l'application.",
                "Après la fin, vous gardez 3 jours de grâce pendant lesquels tout fonctionne encore.",
                "Ensuite, l'accès à la boutique est mis en pause : vous pouvez toujours vous connecter, exporter vos données et nous écrire, mais plus vendre ni modifier.",
                "Aucun montant ne vous est demandé sans votre accord explicite, et il n'y a aucun prélèvement automatique.",
            ],
        ],
    },
    {
        id: "abonnement",
        title: "Abonnement et paiement",
        body: [
            "Les formules et les tarifs ne sont pas encore publiés : aucune facturation n'a lieu pour le moment. Ils vous seront communiqués par écrit avant toute demande de paiement.",
            "Lorsque l'abonnement sera payant :",
            [
                "il se paie à l'avance, pour une période choisie (un mois, trois mois, un an…) ;",
                "le paiement ouvre l'accès jusqu'à une date précise, visible dans la page Abonnement ;",
                "il n'y a pas de renouvellement automatique : sans nouveau paiement, l'accès suit les mêmes étapes qu'à la fin de l'essai (rappels, 3 jours de grâce, puis pause) ;",
                "un changement de tarif ne s'applique qu'à la période suivante, et vous en êtes informé au moins 30 jours à l'avance.",
            ],
        ],
    },
    {
        id: "remboursement",
        title: "Remboursement",
        body: [
            "Si vous changez d'avis, vous pouvez demander le remboursement d'un premier paiement dans les 7 jours qui le suivent. Au-delà, une période commencée n'est pas remboursée.",
            `Si le service est indisponible plus de 3 jours de suite par la faute de ${COMPANY_NAME}, la durée perdue est ajoutée à votre période, ou remboursée si vous le préférez.`,
        ],
    },
    {
        id: "usage",
        title: "Usage acceptable",
        body: [
            "Vous vous engagez à utiliser le service de façon loyale. Il est interdit de :",
            [
                "utiliser le service pour une activité illégale ou frauduleuse ;",
                "tenter d'accéder aux données d'une autre boutique ou de contourner les protections ;",
                "perturber le fonctionnement du service ou le surcharger volontairement ;",
                "copier, revendre ou redistribuer le logiciel sans autorisation.",
            ],
        ],
    },
    {
        id: "donnees",
        title: "Données du commerçant",
        body: [
            `Les données que vous saisissez (produits, ventes, clients, caisse) restent les vôtres. Vous nous autorisez à les héberger et à les traiter uniquement pour faire fonctionner ${PRODUCT_NAME}. Vous pouvez les exporter à tout moment depuis les paramètres, même quand l'accès est en pause. Notre traitement des données est détaillé dans la politique de confidentialité.`,
        ],
    },
    {
        id: "hors-ligne",
        title: "Vente sans internet",
        body: [
            "Sans connexion, la vente continue : le catalogue et les ventes sont gardés sur l'appareil, puis envoyés automatiquement au retour d'internet, sans jamais être comptés deux fois.",
            [
                "Tant qu'elles ne sont pas envoyées, ces ventes n'existent que sur cet appareil : si vous effacez les données du navigateur ou perdez l'appareil avant l'envoi, elles sont perdues.",
                "Le stock et les prix affichés sont ceux du dernier passage en ligne ; le stock peut donc devenir négatif, à corriger par un inventaire.",
                "Une vente refusée à l'envoi (produit retiré, caisse fermée) reste dans « Ventes en attente » pour que vous la vérifiiez.",
            ],
        ],
    },
    {
        id: "disponibilite",
        title: "Disponibilité du service",
        body: [
            "Nous faisons de notre mieux pour que le service soit disponible en continu, mais nous ne pouvons pas garantir l'absence d'interruptions : maintenance, incident technique ou panne d'un prestataire. La base de données est sauvegardée chaque jour. Nous vous recommandons tout de même d'exporter régulièrement vos données.",
        ],
    },
    {
        id: "propriete",
        title: "Propriété intellectuelle",
        body: [
            `${PRODUCT_NAME}, son code, son design et sa marque appartiennent à ${COMPANY_NAME}. Votre abonnement ou votre essai vous donne un droit d'usage personnel, non exclusif et non transférable. Votre nom, votre logo et vos contenus restent votre propriété.`,
        ],
    },
    {
        id: "responsabilite",
        title: "Responsabilité",
        body: [
            `${PRODUCT_NAME} est un outil d'aide à la gestion : vous restez responsable de vos décisions commerciales, de votre comptabilité et de vos obligations légales. Dans les limites permises par la loi, ${COMPANY_NAME} ne répond pas des dommages indirects (perte de chiffre d'affaires, perte de clientèle) liés à l'utilisation du service.`,
        ],
    },
    {
        id: "resiliation",
        title: "Résiliation",
        body: [
            `Vous pouvez arrêter d'utiliser ${PRODUCT_NAME} quand vous le souhaitez, sans frais ni préavis : il suffit de ne pas renouveler, ou de nous demander la fermeture de votre boutique.`,
            "Nous pouvons suspendre ou fermer un compte en cas de non-respect de ces conditions, en vous prévenant lorsque c'est possible.",
            "Après la fin de l'accès, vos données sont conservées au moins 90 jours pour que vous puissiez revenir ou les exporter. Passé ce délai, nous pouvons les supprimer, après vous avoir prévenu par e-mail.",
        ],
    },
    {
        id: "droit-applicable",
        title: "Droit applicable",
        body: [
            "Ces conditions sont régies par le droit applicable au lieu d'établissement de l'éditeur. En cas de désaccord, nous cherchons d'abord une solution à l'amiable avant toute autre démarche. Nous pouvons modifier ces conditions ; en cas de changement important, nous vous en informerons.",
        ],
    },
    {
        id: "contact",
        title: "Contact",
        body: [
            `Une question sur ces conditions ? Écrivez-nous à ${CONTACT.email} ou depuis la page Contact de l'application.`,
        ],
    },
];
