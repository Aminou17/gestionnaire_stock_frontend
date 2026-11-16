import { COMPANY_NAME, PRODUCT_NAME } from "../../../core/brand";
import { CONTACT } from "../../../core/contact";
import { LegalSection } from "../legal-page/legal-section";

export const TERMS_UPDATED = "Dernière mise à jour : 15 novembre 2026";

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
        ],
    },
    {
        id: "essai",
        title: "Essai gratuit",
        body: [
            `${PRODUCT_NAME} est actuellement proposé avec une période d'essai gratuite, pendant laquelle toutes les fonctionnalités sont disponibles. Nous vous préviendrons bien avant la fin de l'essai. Vous ne serez débité d'aucun montant sans votre accord explicite.`,
        ],
    },
    {
        id: "abonnement",
        title: "Abonnement et paiement",
        body: [
            "Les abonnements payants ne sont pas encore disponibles. Les formules, les tarifs et les moyens de paiement seront communiqués prochainement. Aucune facturation n'a lieu pour le moment.",
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
            `Les données que vous saisissez (produits, ventes, clients, caisse) restent les vôtres. Vous nous autorisez à les héberger et à les traiter uniquement pour faire fonctionner ${PRODUCT_NAME}. Vous pouvez les exporter à tout moment depuis les paramètres. Notre traitement des données est détaillé dans la politique de confidentialité.`,
        ],
    },
    {
        id: "disponibilite",
        title: "Disponibilité du service",
        body: [
            "Nous faisons de notre mieux pour que le service soit disponible en continu, mais nous ne pouvons pas garantir l'absence d'interruptions : maintenance, incident technique ou panne d'un prestataire. Nous vous recommandons d'exporter régulièrement vos données.",
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
            `Vous pouvez arrêter d'utiliser ${PRODUCT_NAME} et demander la suppression de votre compte quand vous le souhaitez. Nous pouvons suspendre ou fermer un compte en cas de non-respect de ces conditions, en vous prévenant lorsque c'est possible. Après la fermeture, vos données sont traitées comme indiqué dans la politique de confidentialité.`,
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
