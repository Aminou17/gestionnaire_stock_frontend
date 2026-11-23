import { CONTACT } from "../../../core/contact";
import { COMPANY_NAME, PRODUCT_NAME } from "../../../core/brand";
import { LegalSection } from "../legal-page/legal-section";

export const PRIVACY_UPDATED = "Dernière mise à jour : 20 novembre 2026";

export const PRIVACY_INTRO = `Vos données sont celles de votre commerce. Cette page explique simplement lesquelles nous conservons, pourquoi, et comment vous gardez la main dessus.`;

export const PRIVACY_SECTIONS: LegalSection[] = [
    {
        id: "qui-sommes-nous",
        title: "Qui sommes-nous",
        body: [
            `${PRODUCT_NAME} est un logiciel de gestion de boutique (ventes, caisse, stock, clients) édité par ${COMPANY_NAME}. Dans cette politique, « nous » désigne ${COMPANY_NAME}, et « vous » la personne ou l'entreprise qui utilise ${PRODUCT_NAME}.`,
        ],
    },
    {
        id: "donnees-collectees",
        title: "Données que nous collectons",
        body: [
            "Nous traitons uniquement les données nécessaires au fonctionnement du service.",
            [
                "Votre compte : nom, prénom, adresse e-mail et mot de passe (conservé sous forme chiffrée, jamais en clair).",
                "Votre boutique : nom, logo, coordonnées et informations légales (adresse, téléphone, numéro IFU, RCCM).",
                "Les données que vous saisissez : produits, stocks, ventes, caisse, fournisseurs, ainsi que vos clients et leurs numéros de téléphone.",
                "Des données techniques : journaux de connexion, adresse IP et type d'appareil ou de navigateur.",
                "Votre abonnement : dates d'essai et de paiement.",
                "Des statistiques d'usage : le nom des pages que votre équipe ouvre chaque jour (jamais ce qui y est saisi) et les totaux de vos ventes et de votre marge, sans le détail de vos ventes ni de vos clients. Elles servent à améliorer le service et à fixer un tarif juste.",
            ],
        ],
    },
    {
        id: "roles",
        title: "Rôles : qui est responsable de quoi",
        body: [
            `Les données de vos propres clients vous appartiennent. Vous en êtes le responsable : vous décidez de les collecter et de les utiliser, et vous informez vos clients si nécessaire.`,
            `${COMPANY_NAME} agit comme sous-traitant : nous hébergeons et traitons ces données uniquement pour faire fonctionner ${PRODUCT_NAME} pour vous, selon vos instructions. Pour les données de votre compte et les données techniques, nous sommes responsables du traitement.`,
        ],
    },
    {
        id: "finalites",
        title: "Pourquoi nous utilisons vos données",
        body: [
            [
                "Fournir le service : créer votre compte, afficher votre boutique, enregistrer vos ventes et votre stock.",
                "Assurer la sécurité : repérer les connexions anormales, prévenir les abus et protéger les comptes.",
                "Vous aider : répondre à vos demandes de support.",
                "Améliorer le produit : comprendre ce qui est utile et corriger les erreurs.",
                "Respecter nos obligations légales.",
            ],
        ],
    },
    {
        id: "base-legale",
        title: "Base légale",
        body: [
            "Nous traitons vos données parce que c'est nécessaire pour exécuter le service que vous avez demandé, parce que nous avons un intérêt légitime à garder le service sûr et à l'améliorer, ou parce que la réglementation applicable nous l'impose. Lorsque votre accord est nécessaire, vous pouvez le retirer à tout moment.",
        ],
    },
    {
        id: "partage",
        title: "Partage et sous-traitants",
        body: [
            "Nous ne vendons jamais vos données et nous n'affichons aucune publicité. Nous faisons appel à quelques prestataires techniques, uniquement pour faire fonctionner le service :",
            [
                "Render, pour héberger l'application.",
                "Neon, pour la base de données.",
                "Cloudflare, pour la sécurité et la diffusion du site.",
                "Brevo, pour envoyer les e-mails du service (code de confirmation, mot de passe oublié, alertes de stock, rappels d'abonnement).",
            ],
            "Ces prestataires n'accèdent à vos données que pour rendre ce service. Nous pouvons aussi communiquer des données si une autorité compétente l'exige légalement.",
        ],
    },
    {
        id: "transferts",
        title: "Transferts hors du pays",
        body: [
            "Nos prestataires peuvent héberger les données dans d'autres pays que le vôtre. Dans ce cas, nous veillons à ce qu'un niveau de protection approprié s'applique, conformément à la réglementation applicable en matière de protection des données personnelles.",
        ],
    },
    {
        id: "conservation",
        title: "Durée de conservation",
        body: [
            "Nous conservons vos données tant que votre compte est actif, afin que votre historique de ventes et de stock reste disponible.",
            "Après la fin de l'essai ou de l'abonnement, elles sont gardées au moins 90 jours pour que vous puissiez revenir ou les exporter, puis elles peuvent être supprimées après un e-mail de prévenance.",
            "Les codes de confirmation expirent après 15 minutes et les sessions après 30 jours sans utilisation.",
            "Si vous fermez votre boutique ou demandez la suppression de vos données, nous les supprimons ou les anonymisons dans un délai raisonnable. Certaines informations peuvent être gardées plus longtemps lorsque la loi l'impose ou pour nous protéger en cas de litige. Les sauvegardes sont renouvelées régulièrement et s'effacent de façon progressive.",
        ],
    },
    {
        id: "securite",
        title: "Sécurité",
        body: [
            [
                "Connexion chiffrée (HTTPS) entre votre appareil et nos serveurs.",
                "Mots de passe hachés : personne, pas même nous, ne peut les lire.",
                "Adresse e-mail confirmée par un code à l'inscription, et compte bloqué 15 minutes après 5 mots de passe faux.",
                "Limites sur le nombre de tentatives, pour freiner les robots.",
                "Isolation des données par boutique : une boutique ne voit jamais les données d'une autre.",
                "Sauvegardes régulières de la base de données.",
                "Rôles et droits d'accès : un employé ne voit que ce que l'administrateur lui autorise.",
            ],
            "Aucun système n'est infaillible. Si un incident touchait vos données, nous vous préviendrions dans les meilleurs délais.",
        ],
    },
    {
        id: "droits",
        title: "Vos droits",
        body: [
            "Conformément à la réglementation applicable en matière de protection des données personnelles, vous pouvez :",
            [
                "accéder à vos données ;",
                "les faire rectifier ;",
                "demander leur suppression ;",
                "vous opposer à certains traitements ;",
                "récupérer vos données dans un format réutilisable (portabilité).",
            ],
            `Pour exercer un droit, écrivez-nous à ${CONTACT.email}. Nous pouvons vous demander de confirmer votre identité. Si vous êtes client d'une boutique, adressez-vous d'abord au commerçant, responsable de vos données.`,
        ],
    },
    {
        id: "cookies",
        title: "Stockage local et cookies",
        body: [
            [
                "Un jeton de session, gardé dans votre navigateur, vous maintient connecté jusqu'à 30 jours.",
                "Vos préférences (thème clair ou sombre, affichage des listes) sont mémorisées sur votre appareil.",
                "Pour vendre sans internet, le catalogue (produits, prix, stock), l'état de votre caisse et les ventes pas encore envoyées sont gardés sur l'appareil. Ils s'effacent avec les données du navigateur.",
            ],
            "La caméra ne sert qu'à lire les codes-barres, quand vous la lancez : aucune image n'est enregistrée ni envoyée.",
            "Nous n'utilisons aucun cookie publicitaire ni outil de suivi à but commercial.",
        ],
    },
    {
        id: "mineurs",
        title: "Mineurs",
        body: [
            `${PRODUCT_NAME} s'adresse aux commerçants et à leurs équipes. Il n'est pas destiné aux enfants et nous ne collectons pas sciemment de données auprès de mineurs. Si vous pensez qu'un mineur nous a transmis des données, contactez-nous pour que nous les supprimions.`,
        ],
    },
    {
        id: "modifications",
        title: "Modifications de la politique",
        body: [
            "Nous pouvons mettre à jour cette politique, par exemple lorsque le service évolue. La date de dernière mise à jour figure en haut de la page. En cas de changement important, nous vous en informerons dans l'application ou par e-mail.",
        ],
    },
    {
        id: "contact",
        title: "Contact",
        body: [
            `Une question sur vos données ? Écrivez à ${CONTACT.email} ou depuis la page Contact de l'application, où vous trouverez tous les moyens de nous joindre.`,
        ],
    },
];
