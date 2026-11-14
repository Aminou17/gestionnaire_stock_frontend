import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { COMPANY_NAME, PRODUCT_NAME } from "../../../core/brand";

@Component({
    selector: "app-auth-layout",
    imports: [RouterOutlet],
    templateUrl: "./auth-layout.html",
    styleUrl: "./auth-layout.css",
})
export class AuthLayout {
    year = new Date().getFullYear();
    productName = PRODUCT_NAME;
    companyName = COMPANY_NAME;
}
