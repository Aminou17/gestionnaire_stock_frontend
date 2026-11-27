import { DatePipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { AnnouncementService } from "../../../core/announcements/announcement.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { EmptyState } from "../../../shared/empty-state/empty-state";
import { Icon } from "../../../shared/icon/icon";
import { ReceiptTotals } from "./receipt-totals";

// Les messages envoyés ou programmés par le propriétaire, avec leurs totaux
@Component({
    selector: "app-announcements",
    imports: [DatePipe, RouterLink, PageHeader, EmptyState, Icon, ReceiptTotals],
    templateUrl: "./announcements.html",
    styleUrl: "./announcements.css",
})
export class Announcements {
    private service = inject(AnnouncementService);

    sent = rxResource({ stream: () => this.service.getSent() });
}
