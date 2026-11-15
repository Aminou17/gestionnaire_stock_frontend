import { AuditLog } from "./audit-log.model";

// une connexion échouée n'a pas d'auteur : on montre l'email essayé
export const getAuditAuthor = (log: AuditLog) => {
    if (log.user_name) return log.user_name;
    const email = log.details?.["attemptedEmail"];
    return typeof email === "string" && email ? email : "Inconnu";
};

// dans la phrase du journal, le prénom suffit ; le nom complet est dans le détail
export const getAuditFirstName = (log: AuditLog) =>
    log.user_name ? log.user_name.trim().split(/\s+/)[0] : getAuditAuthor(log);
