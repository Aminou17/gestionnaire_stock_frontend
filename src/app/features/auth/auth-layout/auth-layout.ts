import { Component } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";

import { COMPANY_NAME, PRODUCT_NAME } from "../../../core/brand";
import { Icon } from "../../../shared/icon/icon";
import { ThemeToggle } from "../../../shared/theme-toggle/theme-toggle";

@Component({
    selector: "app-auth-layout",
    imports: [RouterOutlet, RouterLink, Icon, ThemeToggle],
    templateUrl: "./auth-layout.html",
    styleUrl: "./auth-layout.css",
})
export class AuthLayout {
    year = new Date().getFullYear();
    productName = PRODUCT_NAME;
    companyName = COMPANY_NAME;
}
