import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { AuthLayout } from "./auth-layout";

describe("AuthLayout", () => {
    it("should display the shop logo", async () => {
        await TestBed.configureTestingModule({
            imports: [AuthLayout],
            providers: [provideRouter([])],
        }).compileComponents();

        const fixture = TestBed.createComponent(AuthLayout);
        await fixture.whenStable();

        const logo = fixture.nativeElement.querySelector("img.logo") as HTMLImageElement;
        expect(logo.alt).toBe("Awa Bazin");
    });
});
