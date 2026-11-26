import { UsageDay } from "./owned-shop.model";

const pad = (value: number) => String(value).padStart(2, "0");

// AAAA-MM-JJ du jour local, comme les dates de l'API
export const isoDay = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Les N derniers jours, du plus ancien à aujourd'hui, avec le nombre de pages ouvertes (0 sans activité)
export const lastDays = (rows: UsageDay[], days: number, today = new Date()) => {
    const byDay = new Map(rows.map((row) => [row.day, row.views]));

    return Array.from({ length: days }, (_, i) => {
        const date = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() - (days - 1 - i),
        );
        const day = isoDay(date);
        return { day, date, views: byDay.get(day) ?? 0 };
    });
};

// Hauteur d'une barre en pourcentage du plus grand jour, avec un minimum visible quand il y a de l'activité
export const barHeight = (views: number, max: number) =>
    max <= 0 || views <= 0 ? 0 : Math.max(8, Math.round((views / max) * 100));
