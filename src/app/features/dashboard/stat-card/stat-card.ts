import { Component, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";

import { Icon } from "../../../shared/icon/icon";
import { IconName } from "../../../shared/icon/icons";
import { MoneyToggle } from "../../../shared/money/money-toggle";

type Tone = "primary" | "success" | "warning" | "danger" | "muted";
// couleur de la carte : fond teinté et liseré
type CardTone = "primary" | "success" | "warning" | "danger";

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
    // la grande carte du haut de page
    hero = input(false);
    valueTone = input<Tone>();
    hintTone = input<Tone>("muted");
    link = input<string>();
    // montant important : un clic le masque en points
    money = input(false);
    // la carte sert d'interrupteur (valeur masquée) au lieu de mener à une page
    toggles = input(false);
    toggled = output<void>();
    loading = input(false);
    error = input(false);
}
