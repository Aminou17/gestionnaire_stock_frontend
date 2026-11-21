import { DatePipe } from "@angular/common";
import { Component, computed, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";

import { Icon } from "../../../shared/icon/icon";

// Le message unique « la caisse ne permet pas encore de travailler », avec le geste qui règle le cas
export type CashNoticeState = "notOpened" | "closedToday" | "previous";

@Component({
    selector: "app-cash-closed-notice",
    imports: [DatePipe, RouterLink, Icon],
    templateUrl: "./cash-closed-notice.html",
    styleUrl: "./cash-closed-notice.css",
})
export class CashClosedNotice {
    state = input.required<CashNoticeState>();
    // ce qu'on veut faire, pour finir la phrase : « vendre », « payer une dépense »
    purpose = input("vendre");
    // jour de la caisse oubliée, pour l'état « previous »
    since = input<string | null>(null);
    // l'administrateur seul peut rouvrir une caisse clôturée
    canReopen = input(false);
    // petite ligne dans une page, au lieu d'une grande carte au centre
    compact = input(false);

    openCash = output();
    reopen = output();

    tone = computed(() =>
        this.state() === "notOpened"
            ? "primary"
            : this.state() === "previous"
              ? "warning"
              : "neutral",
    );

    title = computed(() => {
        switch (this.state()) {
            case "notOpened":
                return "Caisse pas encore ouverte";
            case "closedToday":
                return "Caisse clôturée pour aujourd'hui";
            default:
                return "Caisse d'un jour passé pas clôturée";
        }
    });

    text = computed(() => {
        switch (this.state()) {
            case "notOpened":
                return `Ouvrez-la pour ${this.purpose()}.`;
            case "closedToday":
                return this.canReopen()
                    ? `Rouvrez-la pour ${this.purpose()}.`
                    : `Demandez à l'administrateur de la rouvrir pour ${this.purpose()}, sinon rendez-vous demain.`;
            default:
                return "Clôturez-la avant d'ouvrir celle d'aujourd'hui.";
        }
    });
}
