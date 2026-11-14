import { DatePipe } from "@angular/common";
import { Component, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";

import { Sale } from "../../../core/sales/sale.model";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";

@Component({
    selector: "app-recent-sales",
    imports: [RouterLink, DatePipe, FcfaPipe],
    templateUrl: "./recent-sales.html",
    styleUrl: "./recent-sales.css",
})
export class RecentSales {
    title = input("Dernières ventes");
    linkLabel = input("Toutes les ventes");
    sales = input<Sale[]>([]);
    loading = input(false);
    error = input(false);
    // le manager ne voit que ses propres ventes : la colonne vendeur ne sert à rien
    showSeller = input(true);
    retry = output();

    isToday(date: string) {
        return new Date(date).toDateString() === new Date().toDateString();
    }
}
