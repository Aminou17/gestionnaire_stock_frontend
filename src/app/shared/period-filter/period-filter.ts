import { formatDate } from "@angular/common";
import { Component, LOCALE_ID, inject, input, output, signal } from "@angular/core";

export type Period = "today" | "week" | "month" | "all" | "custom";

// période choisie et ses dates (YYYY-MM-DD, null = pas de borne)
export interface PeriodRange {
    period: Period;
    from: string | null;
    to: string | null;
}

// nombre de jours à remonter, aujourd'hui compris
const PERIOD_DAYS: Record<Exclude<Period, "custom">, number | null> = {
    today: 1,
    week: 7,
    month: 30,
    all: null,
};

export const validateRange = (from: string, to: string, today: string) => {
    if (!from || !to) return "Choisissez une date de début et une date de fin.";
    if (from > today || to > today) return "Une date ne peut pas être dans le futur.";
    if (from > to) return "La date de début doit précéder la date de fin.";
    return null;
};

// Sélecteur de période (Ventes, Entrées de stock) : périodes toutes faites ou dates choisies.
// N'émet que des périodes valides ; ce qui est projeté se place à droite du sélecteur.
@Component({
    selector: "app-period-filter",
    templateUrl: "./period-filter.html",
    styleUrl: "./period-filter.css",
    host: { "[class.chips]": "chips()", "[class.stacked]": "stacked()", "[class.flat]": "flat()" },
})
export class PeriodFilter {
    private locale = inject(LOCALE_ID);

    changed = output<PeriodRange>();
    // affichage en pastilles, sans libellé visible (Journal d'audit)
    chips = input(false);
    // sur téléphone, les filtres s'empilent en pleine largeur (panneau Filtres des Ventes)
    stacked = input(false);
    // sur téléphone, sans cadre ni défilement : pour le placer dans une fenêtre de filtres
    flat = input(false);

    period = signal<Period>("all");
    customFrom = signal("");
    customTo = signal("");
    customError = signal<string | null>(null);
    // dernière période personnalisée valide
    private customRange: { from: string; to: string } | null = null;

    today() {
        return formatDate(new Date(), "yyyy-MM-dd", this.locale);
    }

    selectPeriod(value: string) {
        const period = value as Period;
        this.customError.set(null);
        this.period.set(period);

        if (period === "custom") {
            // on part des 7 derniers jours : l'utilisateur n'a plus qu'à ajuster
            if (!this.customRange) {
                this.customFrom.set(this.daysAgo(6));
                this.customTo.set(this.today());
                this.customRange = { from: this.customFrom(), to: this.customTo() };
            }
            this.changed.emit({ period, ...this.customRange });
            return;
        }

        const days = PERIOD_DAYS[period];
        this.changed.emit(
            days === null
                ? { period, from: null, to: null }
                : { period, from: this.daysAgo(days - 1), to: this.today() },
        );
    }

    applyCustomRange(from: string, to: string) {
        this.customFrom.set(from);
        this.customTo.set(to);

        const error = validateRange(from, to, this.today());
        this.customError.set(error);
        if (error) return;

        this.customRange = { from, to };
        this.changed.emit({ period: "custom", from, to });
    }

    // Date d'il y a n jours au format YYYY-MM-DD
    private daysAgo(days: number) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return formatDate(date, "yyyy-MM-dd", this.locale);
    }
}
