import { formatDate } from "@angular/common";

// "Aujourd'hui", "Hier" ou la date, pour les listes groupées par jour
export const getDayLabel = (date: Date, locale: string) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === new Date().toDateString()) return "Aujourd'hui";
    if (date.toDateString() === yesterday.toDateString()) return "Hier";
    return formatDate(date, "d MMMM y", locale);
};

// Regroupe des éléments déjà triés du plus récent au plus ancien
export const groupByDay = <T extends { created_at: string }>(items: T[], locale: string) => {
    const days: { key: string; label: string; items: T[] }[] = [];
    for (const item of items) {
        const date = new Date(item.created_at);
        const key = date.toDateString();
        let day = days.at(-1);
        if (day?.key !== key) {
            day = { key, label: getDayLabel(date, locale), items: [] };
            days.push(day);
        }
        day.items.push(item);
    }
    return days;
};
