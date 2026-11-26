import { formatDate } from "@angular/common";

import { UserAccount } from "./user.model";

// Sans 0, O, 1, l ni I, qu'on confond quand on dicte ou recopie le mot de passe
const PASSWORD_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generatePassword = (length = 10) => {
    const values = crypto.getRandomValues(new Uint32Array(length));
    return Array.from(values, (value) => PASSWORD_CHARS[value % PASSWORD_CHARS.length]).join("");
};

// "Aujourd'hui à 14:32", "Hier à 09:10", puis "3 nov. 2026"
export const formatLastLogin = (date: string | null, locale: string) => {
    if (!date) return "Jamais connecté";

    const day = new Date(date);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (day.toDateString() === new Date().toDateString()) {
        return `Aujourd'hui à ${formatDate(day, "HH:mm", locale)}`;
    }
    if (day.toDateString() === yesterday.toDateString()) {
        return `Hier à ${formatDate(day, "HH:mm", locale)}`;
    }
    return formatDate(day, "d MMM y", locale);
};

// "Supprimé le 3 nov. 2026 par Admin Test" (l'auteur peut manquer sur les anciens comptes)
export const formatDeletion = (user: UserAccount, locale: string) => {
    if (!user.deleted_at) return "Supprimé";
    const text = `Supprimé le ${formatDate(user.deleted_at, "d MMM y", locale)}`;
    return user.deleted_by_name ? `${text} par ${user.deleted_by_name}` : text;
};
