import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Title } from "@angular/platform-browser";
import { RouterStateSnapshot } from "@angular/router";

import { ShopSettingsService } from "./shop-settings.service";
import { PRODUCT_NAME } from "../brand";
import { ShopTitleStrategy } from "./shop-title-strategy";

describe("ShopTitleStrategy", () => {
    const shopName = signal("");
    let strategy: ShopTitleStrategy;
    let title: Title;

    beforeEach(() => {
        shopName.set("");
        TestBed.configureTestingModule({
            providers: [{ provide: ShopSettingsService, useValue: { shopName } }],
        });
        strategy = TestBed.inject(ShopTitleStrategy);
        title = TestBed.inject(Title);
        vi.spyOn(strategy, "buildTitle").mockReturnValue("Produits");
    });

    const navigate = () => {
        strategy.updateTitle({} as RouterStateSnapshot);
        TestBed.tick();
    };

    it("should use the product name while the shop is unknown", () => {
        navigate();
        expect(title.getTitle()).toBe(`Produits · ${PRODUCT_NAME}`);
    });

    it("should show the shop name as soon as it is loaded", () => {
        navigate();
        shopName.set("Chez Fatou");
        TestBed.tick();
        expect(title.getTitle()).toBe("Produits · Chez Fatou");
    });
});
