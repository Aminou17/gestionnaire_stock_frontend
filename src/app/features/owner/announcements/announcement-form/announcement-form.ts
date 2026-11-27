import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

import { AnnouncementAction } from "../../../../core/announcements/announcement.model";
import { AnnouncementService } from "../../../../core/announcements/announcement.service";
import { PageHeader } from "../../../../layout/page-header/page-header";
import { OwnerShopService } from "../../owner-shop.service";

// Écrire un envoi, tout de suite ou programmé ; la même page modifie un envoi pas encore parti
@Component({
    selector: "app-announcement-form",
    imports: [FormsModule, PageHeader],
    templateUrl: "./announcement-form.html",
    styleUrl: "./announcement-form.css",
})
export class AnnouncementForm {
    private service = inject(AnnouncementService);
    private owner = inject(OwnerShopService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    protected id = Number(this.route.snapshot.paramMap.get("id")) || null;
    // Depuis la fiche d'une boutique, elle est déjà choisie
    private presetShop = Number(this.route.snapshot.queryParamMap.get("shop")) || null;
    protected back = this.id ? `/owner/announcements/${this.id}` : "/owner/announcements";

    subject = signal("");
    body = signal("");
    action = signal<AnnouncementAction | "">("");
    audience = signal<"ALL" | "SELECTED">(this.presetShop ? "SELECTED" : "ALL");
    selected = signal<number[]>(this.presetShop ? [this.presetShop] : []);
    scheduled = signal(false);
    // Valeur d'un champ datetime-local, à l'heure de l'appareil
    sendAt = signal("");

    saving = signal(false);
    error = signal<string | null>(null);

    private allShops = rxResource({ stream: () => this.owner.getShops() });
    shops = computed(() =>
        (this.allShops.hasValue() ? this.allShops.value() : []).filter(
            (shop) => !shop.deleted_at && shop.status === "ACTIVE",
        ),
    );

    ready = computed(
        () =>
            !!this.subject().trim() &&
            !!this.body().trim() &&
            (this.audience() === "ALL" || this.selected().length > 0) &&
            (!this.scheduled() || !!this.sendAt()),
    );

    constructor() {
        if (!this.id) return;

        this.service.getOne(this.id).subscribe({
            next: (sent) => {
                this.subject.set(sent.subject);
                this.body.set(sent.body);
                this.action.set(sent.action ?? "");
                this.audience.set(sent.audience);
                this.selected.set(sent.recipients.map((r) => r.shop_id));
                this.scheduled.set(true);
                this.sendAt.set(toLocalInput(sent.send_at));
            },
            error: () => this.error.set("Impossible de charger ce message."),
        });
    }

    toggleShop(id: number) {
        this.selected.update((ids) =>
            ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
        );
    }

    submit() {
        if (!this.ready() || this.saving()) return;

        this.saving.set(true);
        this.error.set(null);

        this.service
            .save(
                {
                    subject: this.subject().trim(),
                    body: this.body().trim(),
                    action: this.action() || null,
                    audience: this.audience(),
                    shopIds: this.audience() === "SELECTED" ? this.selected() : [],
                    sendAt: this.scheduled() ? new Date(this.sendAt()).toISOString() : null,
                },
                this.id,
            )
            .subscribe({
                next: (saved) => this.router.navigate(["/owner/announcements", saved.id]),
                error: (err: HttpErrorResponse) => {
                    this.saving.set(false);
                    this.error.set(err.error?.message ?? "L'envoi a échoué, réessayez.");
                },
            });
    }
}

function toLocalInput(iso: string) {
    const date = new Date(iso);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
}
