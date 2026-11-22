import { FailedLogin, FailedLoginIp, LockedAccount, SecurityEvent } from "../security.model";
import type { IconName } from "../../../../shared/icon/icons";
import { RowTone, SecurityRow, TableHeadings } from "../security-table/security-table";

export type ListKind = "logins" | "locked" | "events" | "history";
export type FilterName = "shop" | "email" | "ip" | "period";

export interface ListConfig {
    // route de l'API sous /security
    path: string;
    // nom du paramètre qui choisit la vue (view ou type), et les vues possibles
    viewParam?: "view" | "type";
    views?: { value: string; label: string }[];
    filters: FilterName[];
    exportName: string;
    headings: (view: string) => TableHeadings;
    emptyText: (view: string) => string;
    toRows: (view: string, data: unknown[]) => SecurityRow[];
}

// libellés courts : ceux du journal des boutiques sont des phrases entières
export const EVENT_LABELS: Record<string, string> = {
    ACCESS_DENIED: "Accès refusé",
    PASSWORD_CHANGED: "Mot de passe changé",
    PASSWORD_CHANGE_FAILED: "Changement refusé",
    USER_PASSWORD_RESET: "Mot de passe réinitialisé",
    PASSWORD_RESET_REQUESTED: "Réinitialisation demandée",
    PASSWORD_RESET_COMPLETED: "Réinitialisation terminée",
    SHOP_ADMIN_RESET_LINK_SENT: "Lien envoyé à l'administrateur",
    SHOP_ADMIN_TEMP_PASSWORD_SET: "Mot de passe provisoire",
    TWO_FACTOR_ENABLED: "Double authentification activée",
    TWO_FACTOR_DISABLED: "Double authentification désactivée",
    TWO_FACTOR_FAILED: "Code incorrect",
    SHOP_CREATED: "Boutique créée",
    SHOP_REGISTERED: "Boutique inscrite",
    SHOP_SUSPENDED: "Boutique suspendue",
    SHOP_ACTIVATED: "Boutique réactivée",
    SHOP_DELETED: "Boutique supprimée",
    SHOP_RESTORED: "Boutique restaurée",
    SHOP_TRIAL_CHANGED: "Essai modifié",
    SHOP_PAID_UNTIL_CHANGED: "Paiement enregistré",
    AUTH_LOGIN_SUCCEEDED: "Connexion réussie",
    AUTH_LOGIN_FAILED: "Connexion échouée",
    AUTH_EMAIL_VERIFIED: "E-mail confirmé",
    AUTH_LOGOUT_ALL: "Déconnexion de tous les appareils",
    MAIL_SETTINGS_UPDATED: "E-mail d'envoi modifié",
    MAIL_SETTINGS_REMOVED: "E-mail d'envoi retiré",
    MAIL_TEST_SENT: "E-mail de test envoyé",
};

const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

const failedLoginRows = (data: FailedLogin[]): SecurityRow[] =>
    data.map((login) => ({
        id: login.id,
        icon: "alert",
        tone: login.suspicious ? "danger" : "warning",
        title: login.email ?? "Adresse inconnue",
        subtitle: null,
        shop: login.shop_name,
        detail: login.ip_address,
        badge: login.suspicious
            ? { label: "Suspecte", tone: "danger" }
            : { label: "Échec", tone: "neutral" },
        when: login.created_at,
    }));

const ipRows = (data: FailedLoginIp[]): SecurityRow[] =>
    data.map((group) => ({
        id: group.ip_address ?? "inconnue",
        icon: "shield",
        tone: group.suspicious ? "danger" : "neutral",
        title: group.ip_address ?? "Adresse inconnue",
        subtitle: plural(group.emails, "adresse e-mail essayée", "adresses e-mail essayées"),
        shop: group.shops > 0 ? plural(group.shops, "boutique", "boutiques") : null,
        detail: plural(group.attempts, "échec", "échecs"),
        badge: group.suspicious ? { label: "Suspecte", tone: "danger" } : null,
        when: group.last_attempt_at,
    }));

// temps restant avant la fin du blocage, en mots courts
const remaining = (until: string) => {
    const minutes = Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 60000));
    if (minutes < 60) return `dans ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    return `dans ${hours} h ${String(minutes % 60).padStart(2, "0")}`;
};

const lockedRows = (data: LockedAccount[]): SecurityRow[] =>
    data.map((account) => ({
        id: account.id,
        icon: "ban",
        tone: "warning",
        title: account.name,
        subtitle: account.email,
        shop: account.shop_name,
        detail: plural(account.failed_logins, "échec", "échecs"),
        badge: { label: "Bloqué", tone: "warning" },
        when: account.locked_until,
        note: remaining(account.locked_until),
    }));

const eventIcon = (action: string): IconName =>
    action.startsWith("SHOP_") && !action.includes("ADMIN")
        ? "store"
        : action.startsWith("AUTH_")
          ? "user"
          : action.startsWith("MAIL_")
            ? "mail"
            : "key";

const eventRows = (data: SecurityEvent[]): SecurityRow[] =>
    data.map((event) => {
        const denied = event.action === "ACCESS_DENIED";
        const path = denied ? String(event.details?.["path"] ?? "") : "";
        const tone: RowTone = denied
            ? "warning"
            : event.result === "FAILURE"
              ? "danger"
              : "success";

        return {
            id: event.id,
            icon: denied ? "ban" : eventIcon(event.action),
            tone,
            title: EVENT_LABELS[event.action] ?? event.action,
            subtitle: [event.email ?? event.user_name, path].filter(Boolean).join(" · ") || null,
            // les actions du propriétaire sur une boutique n'ont pas de boutique liée : on lit son nom dans le détail
            shop:
                event.shop_name ??
                (typeof event.details?.["name"] === "string" ? event.details["name"] : null),
            detail: event.ip_address,
            badge: {
                label: denied ? "Refusé" : event.result === "FAILURE" ? "Échec" : "Réussi",
                tone,
            },
            when: event.created_at,
            raw: event,
        };
    });

export const LIST_CONFIGS: Record<ListKind, ListConfig> = {
    logins: {
        path: "failed-logins",
        viewParam: "view",
        views: [
            { value: "list", label: "Chronologie" },
            { value: "ip", label: "Par adresse IP" },
        ],
        filters: ["shop", "email", "ip", "period"],
        exportName: "connexions-echouees",
        headings: (view) =>
            view === "ip"
                ? {
                      main: "Adresse IP",
                      shop: "Boutiques",
                      detail: "Échecs",
                      when: "Dernière tentative",
                  }
                : {
                      main: "Adresse e-mail essayée",
                      shop: "Boutique",
                      detail: "Adresse IP",
                      when: "Date",
                  },
        emptyText: () => "Aucune connexion échouée enregistrée.",
        toRows: (view, data) =>
            view === "ip"
                ? ipRows(data as FailedLoginIp[])
                : failedLoginRows(data as FailedLogin[]),
    },
    locked: {
        path: "locked-accounts",
        filters: ["shop", "email"],
        exportName: "comptes-bloques",
        headings: () => ({
            main: "Compte",
            shop: "Boutique",
            detail: "Tentatives",
            when: "Fin du blocage",
        }),
        emptyText: () => "Aucun compte n'est bloqué en ce moment.",
        toRows: (_view, data) => lockedRows(data as LockedAccount[]),
    },
    history: {
        path: "events",
        viewParam: "type",
        views: [
            { value: "all", label: "Tout" },
            { value: "shops", label: "Boutiques" },
            { value: "logins", label: "Connexions" },
            { value: "password", label: "Sécurité" },
        ],
        filters: ["shop", "email", "ip", "period"],
        exportName: "historique",
        headings: () => ({
            main: "Activité",
            shop: "Boutique",
            detail: "Adresse IP",
            when: "Date",
        }),
        emptyText: () => "Aucune activité enregistrée.",
        toRows: (_view, data) => eventRows(data as SecurityEvent[]),
    },
    events: {
        path: "events",
        viewParam: "type",
        views: [
            { value: "denied", label: "Accès refusés" },
            { value: "password", label: "Mots de passe" },
        ],
        filters: ["shop", "email", "ip", "period"],
        exportName: "evenements-securite",
        headings: (view) => ({
            main: view === "password" ? "Événement" : "Accès refusé",
            shop: "Boutique",
            detail: "Adresse IP",
            when: "Date",
        }),
        emptyText: (view) =>
            view === "password"
                ? "Aucun changement ni réinitialisation de mot de passe enregistré."
                : "Aucun accès refusé enregistré.",
        toRows: (_view, data) => eventRows(data as SecurityEvent[]),
    },
};
