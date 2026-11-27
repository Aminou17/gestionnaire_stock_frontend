import { DatePipe, NgClass } from "@angular/common";
import { Component, inject, input } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { AnnouncementService } from "../../../core/announcements/announcement.service";
import { receiptStatus } from "../../../core/announcements/receipt-status";

// Fiche d'une boutique : tout ce qui lui a été envoyé, avec ses accusés
@Component({
    selector: "app-shop-messages",
    imports: [DatePipe, NgClass, RouterLink],
    templateUrl: "./shop-messages.html",
    styleUrl: "./shop-messages.css",
})
export class ShopMessages {
    private service = inject(AnnouncementService);

    shopId = input.required<number>();
    protected status = receiptStatus;

    history = rxResource({
        params: () => this.shopId(),
        stream: ({ params }) => this.service.getShopHistory(params),
    });
}
