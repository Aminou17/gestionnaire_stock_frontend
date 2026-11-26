import { Component, computed, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";

import { Icon } from "../../../shared/icon/icon";
import { IconName } from "../../../shared/icon/icons";
import { MoneyToggle } from "../../../shared/money/money-toggle";

type Tone = "primary" | "success" | "warning" | "danger" | "muted";
// Couleur de la carte : fond teinté et liseré
type CardTone = "primary" | "success" | "warning" | "danger" | "violet";

@Component({
    selector: "app-stat-card",
    imports: [MoneyToggle, Icon, RouterLink],
    templateUrl: "./stat-card.html",
    styleUrl: "./stat-card.css",
})
export class StatCard {
    label = input.required<string>();
    icon = input.required<IconName>();
    value = input<string>();
    hint = input<string>();
    tone = input<CardTone>();
    // La grande carte du haut de page
    hero = input(false);
    valueTone = input<Tone>();
    hintTone = input<Tone>("muted");
    link = input<string>();
    // Filtre à ouvrir directement sur la page (ex. { filter: "unpaid" })
    linkParams = input<Record<string, string>>();
    // Montant important : un clic le masque en points
    money = input(false);
    // La carte sert d'interrupteur (valeur masquée) au lieu de mener à une page
    toggles = input(false);
    toggled = output<void>();
    loading = input(false);
    error = input(false);
    // Petite courbe des derniers jours, pour la grande carte
    spark = input<number[]>([]);

    sparkLine = computed(() => this.sparkPoints().join(" "));

    // Même courbe refermée jusqu'en bas pour colorer la surface dessous
    sparkArea = computed(() => {
        const points = this.sparkPoints();
        return points.length ? `0,40 ${points.join(" ")} 120,40` : "";
    });

    private sparkPoints() {
        const values = this.spark();
        if (values.length < 2) return [];

        const max = Math.max(...values, 1);
        const step = 120 / (values.length - 1);
        return values.map((v, i) => `${(i * step).toFixed(1)},${(36 - (v / max) * 32).toFixed(1)}`);
    }
}
