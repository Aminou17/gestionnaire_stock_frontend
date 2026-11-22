import { Component, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../../core/auth/auth.service";
import { PRODUCT_NAME } from "../../../core/brand";
import { CONTACT, mailtoLink } from "../../../core/contact";
import { SupportService } from "../../../core/support/support.service";
import { Icon } from "../../../shared/icon/icon";
import { LegalPage } from "../legal-page/legal-page";

interface Question {
    question: string;
    answer: string;
}

const QUESTIONS: Question[] = [
    {
        question: "Comment créer ma boutique ?",
        answer: `Sur l'écran de connexion, choisissez « Créer ma boutique », indiquez le nom de votre boutique et vos coordonnées, puis choisissez un mot de passe. Votre espace est prêt en quelques minutes.`,
    },
    {
        question: "J'ai oublié mon mot de passe",
        answer: `Sur l'écran de connexion, touchez « Mot de passe oublié », saisissez votre adresse e-mail : vous recevez un lien pour en choisir un nouveau. Pensez à regarder dans vos courriers indésirables.`,
    },
    {
        question: "Mes données sont-elles en sécurité ?",
        answer: `Oui. La connexion est chiffrée, les mots de passe sont protégés, les données de chaque boutique sont séparées de celles des autres et sauvegardées régulièrement. Tous les détails sont dans la politique de confidentialité.`,
    },
    {
        question: "Comment fonctionne l'essai gratuit ?",
        answer: `Pendant l'essai, vous profitez de toutes les fonctionnalités sans frais et sans carte bancaire. Nous vous préviendrons bien avant la fin, et rien n'est facturé sans votre accord.`,
    },
    {
        question: "Comment ajouter un employé ?",
        answer: `Dans le menu, ouvrez « Utilisateurs » puis « Nouvel utilisateur ». Donnez son nom et son e-mail et choisissez son rôle : il reçoit ses accès et ne voit que ce que son rôle autorise. Cette page est réservée à l'administrateur.`,
    },
];

@Component({
    selector: "app-contact",
    imports: [LegalPage, Icon, RouterLink],
    templateUrl: "./contact.html",
    styleUrl: "./contact.css",
})
export class Contact {
    private auth = inject(AuthService);
    protected support = inject(SupportService);

    protected productName = PRODUCT_NAME;
    protected contact = CONTACT;
    protected mailto = mailtoLink();

    // seuls l'administrateur et les employés écrivent au support dans l'application
    protected canWriteSupport = computed(() => {
        const user = this.auth.user();
        return this.auth.isLoggedIn() && (user?.role === "admin" || user?.role === "manager");
    });

    protected questions = QUESTIONS;
    constructor() {
        if (this.canWriteSupport()) this.support.refreshUnread("user");
    }

    protected openIndex: number | null = null;

    protected toggle(index: number) {
        this.openIndex = this.openIndex === index ? null : index;
    }
}
