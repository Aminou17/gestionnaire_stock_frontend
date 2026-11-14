import { TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";

import { getBackLink } from "./back-link";

describe("getBackLink", () => {
    beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
    afterEach(() => history.replaceState(null, ""));

    const run = () =>
        TestBed.runInInjectionContext(() => {
            const back = getBackLink("/products", "Produits");
            return { url: TestBed.inject(Router).serializeUrl(back.link), label: back.label };
        });

    it("should go back to the page given by the navigation, filters included", () => {
        history.replaceState(
            { backTo: "/stock-movements?productId=3", backLabel: "Mouvements" },
            "",
        );
        expect(run()).toEqual({ url: "/stock-movements?productId=3", label: "Mouvements" });
    });

    it("should fall back to the usual list without a state", () => {
        expect(run()).toEqual({ url: "/products", label: "Produits" });
    });

    it("should go back to the previous page when the origin did not say anything", async () => {
        const router = TestBed.inject(Router);
        router.resetConfig([
            { path: "dashboard", children: [] },
            { path: "products/:id", children: [] },
        ]);
        await router.navigateByUrl("/dashboard");
        const navigation = router.navigateByUrl("/products/5");
        const result = run();
        await navigation;

        expect(result).toEqual({ url: "/dashboard", label: "Retour" });
    });

    it("should ignore an address that is not inside the app", () => {
        history.replaceState({ backTo: "https://exemple.com", backLabel: "Ailleurs" }, "");
        expect(run()).toEqual({ url: "/products", label: "Produits" });
    });
});
