import { Component, input } from "@angular/core";

import { Icon } from "../../../shared/icon/icon";
import { IconName } from "../../../shared/icon/icons";

type Tone = "primary" | "success" | "warning" | "danger" | "muted";
// une seule couleur d'accent : bleu, sauf l'orange réservé aux alertes
type IconTone = "primary" | "warning";

@Component({
    selector: "app-stat-card",
    imports: [Icon],
    templateUrl: "./stat-card.html",
    styleUrl: "./stat-card.css",
})
export class StatCard {
    label = input.required<string>();
    icon = input.required<IconName>();
    value = input<string>();
    hint = input<string>();
    iconTone = input<IconTone>("primary");
    valueTone = input<Tone>();
    hintTone = input<Tone>("muted");
    loading = input(false);
    error = input(false);
}
