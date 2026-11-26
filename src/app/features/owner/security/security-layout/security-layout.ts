import { Component } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

import { PageHeader } from "../../../../layout/page-header/page-header";

// Coquille de la section Sécurité : titre, onglets, puis la page choisie
@Component({
    selector: "app-security-layout",
    imports: [PageHeader, RouterOutlet, RouterLink, RouterLinkActive],
    templateUrl: "./security-layout.html",
    styleUrl: "./security-layout.css",
})
export class SecurityLayout {
    // Libellé court pour le téléphone, long pour l'ordinateur
    tabs = [
        { path: "/owner/security", short: "Aperçu", long: "Vue d'ensemble", exact: true },
        {
            path: "/owner/security/logins",
            short: "Échecs",
            long: "Connexions suspectes",
            exact: false,
        },
        { path: "/owner/security/locked", short: "Bloqués", long: "Comptes bloqués", exact: false },
        {
            path: "/owner/security/history",
            short: "Activité",
            long: "Historique",
            exact: false,
        },
        {
            path: "/owner/security/events",
            short: "Accès",
            long: "Accès refusés et mots de passe",
            exact: false,
        },
    ];
}
