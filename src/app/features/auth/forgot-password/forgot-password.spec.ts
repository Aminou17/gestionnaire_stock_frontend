import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { ForgotPassword } from "./forgot-password";

describe("ForgotPassword", () => {
    it("should create with a link back to the login page", async () => {
        await TestBed.configureTestingModule({
            imports: [ForgotPassword],
            providers: [provideRouter([])],
        }).compileComponents();

        const fixture = TestBed.createComponent(ForgotPassword);
        await fixture.whenStable();

        const link = fixture.nativeElement.querySelector("a") as HTMLAnchorElement;
        expect(link.getAttribute("href")).toBe("/login");
    });
});
