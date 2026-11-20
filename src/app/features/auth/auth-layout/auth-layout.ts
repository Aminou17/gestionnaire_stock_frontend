import { NgTemplateOutlet } from "@angular/common";
import { Component } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";

import { COMPANY_NAME, PRODUCT_NAME } from "../../../core/brand";
import { Icon } from "../../../shared/icon/icon";

@Component({
    selector: "app-auth-layout",
    imports: [RouterOutlet, RouterLink, NgTemplateOutlet, Icon],
    templateUrl: "./auth-layout.html",
    styleUrl: "./auth-layout.css",
})
export class AuthLayout {
    year = new Date().getFullYear();
    productName = PRODUCT_NAME;
    companyName = COMPANY_NAME;

    // hauteur des barres du graphique d'exemple, en pourcentage
    bars = [38, 52, 44, 66, 58, 82, 74];
    days = ["L", "M", "M", "J", "V", "S", "D"];
}
