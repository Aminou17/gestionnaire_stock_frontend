import { DatePipe, NgClass } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { AnnouncementService } from "../../../../core/announcements/announcement.service";
import { receiptStatus } from "../../../../core/announcements/receipt-status";
import { PageHeader } from "../../../../layout/page-header/page-header";
import { ReceiptTotals } from "../receipt-totals";

// Un envoi : son texte, ses totaux et l'état de chaque boutique
@Component({
    selector: "app-announcement-page",
    imports: [DatePipe, NgClass, RouterLink, PageHeader, ReceiptTotals],
    templateUrl: "./announcement-page.html",
    styleUrl: "./announcement-page.css",
})
export class AnnouncementPage {
    private service = inject(AnnouncementService);
    private router = inject(Router);
    private id = Number(inject(ActivatedRoute).snapshot.paramMap.get("id"));

    protected status = receiptStatus;

    sent = rxResource({ stream: () => this.service.getOne(this.id) });

    // L'annulation se confirme sur place, sans fenêtre
    confirming = signal(false);
    busy = signal(false);
    error = signal<string | null>(null);

    cancel() {
        this.busy.set(true);
        this.error.set(null);

        this.service.cancel(this.id).subscribe({
            next: () => this.router.navigate(["/owner/announcements"]),
            error: (err: HttpErrorResponse) => {
                this.busy.set(false);
                this.confirming.set(false);
                this.error.set(err.error?.message ?? "L'annulation a échoué, réessayez.");
                this.sent.reload();
            },
        });
    }
}
