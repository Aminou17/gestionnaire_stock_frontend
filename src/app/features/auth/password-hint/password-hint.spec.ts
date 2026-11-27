import { TestBed } from "@angular/core/testing";

import { PasswordHint } from "./password-hint";

describe("PasswordHint", () => {
    async function render(password: string) {
        const fixture = TestBed.createComponent(PasswordHint);
        fixture.componentRef.setInput("password", password);
        await fixture.whenStable();
        return fixture.nativeElement.querySelector("small") as HTMLElement;
    }

    it("should show the rule without validating a short password", async () => {
        const hint = await render("abc");

        expect(hint.textContent).toContain("Au moins 8 caractères");
        expect(hint.classList.contains("met")).toBe(false);
    });

    it("should validate the rule from 8 characters", async () => {
        const hint = await render("abcdefgh");

        expect(hint.classList.contains("met")).toBe(true);
    });
});
