import { Location } from "@angular/common";
import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";

import { BackLink } from "./back-link";

@Component({ template: "" })
class Empty {}

@Component({
    imports: [BackLink],
    template: `<a appBackLink="/products">Retour</a>`,
})
class Host {}

describe("BackLink", () => {
    let router: Router;
    let location: Location;

    beforeEach(async () => {
        TestBed.configureTestingModule({
            providers: [
                provideRouter([
                    { path: "products", component: Empty },
                    { path: "products/:id", component: Host },
                    { path: "dashboard", component: Empty },
                ]),
            ],
        });
        router = TestBed.inject(Router);
        location = TestBed.inject(Location);
    });

    const click = async () => {
        const fixture = TestBed.createComponent(Host);
        await fixture.whenStable();
        const link = fixture.nativeElement.querySelector("a") as HTMLAnchorElement;
        expect(link.getAttribute("href")).toBe("/products");
        link.click();
    };

    it("should step back in the history when we came from the target page", async () => {
        await router.navigateByUrl("/products");
        await router.navigateByUrl("/products/3");
        const back = vi.spyOn(location, "back").mockImplementation(() => {});

        await click();

        expect(back).toHaveBeenCalled();
    });

    it("should replace the page instead of stacking it when we came from elsewhere", async () => {
        await router.navigateByUrl("/dashboard");
        await router.navigateByUrl("/products/3");
        const back = vi.spyOn(location, "back");
        const navigate = vi.spyOn(router, "navigateByUrl").mockResolvedValue(true);

        await click();

        expect(back).not.toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledWith("/products", { replaceUrl: true });
    });
});
