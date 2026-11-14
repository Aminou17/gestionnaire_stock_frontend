import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AuthLayout } from "./auth-layout";

describe("AuthLayout", () => {
    it("should show the software brand, never the name of a shop", async () => {
        await TestBed.configureTestingModule({
            imports: [AuthLayout],
            providers: [provideRouter([])],
        }).compileComponents();

        const fixture = TestBed.createComponent(AuthLayout);
        await fixture.whenStable();

        const page = fixture.nativeElement as HTMLElement;
        expect(page.querySelector(".logo")).not.toBeNull();
        expect(page.textContent).toContain("Gestionnaire de stock");
        expect(page.textContent).not.toContain("Awa Bazin");
    });
});
