import { TestBed } from "@angular/core/testing";

import { PasswordStrength, passwordLevel } from "./password-strength";

describe("passwordLevel", () => {
    it("should be 0 when nothing is typed and 1 under 8 characters", () => {
        expect(passwordLevel("")).toBe(0);
        expect(passwordLevel("Ab1!")).toBe(1);
    });

    it("should grow with length and variety", () => {
        expect(passwordLevel("motdepasse")).toBe(1);
        expect(passwordLevel("motdepasse12")).toBe(2);
        expect(passwordLevel("Boutique2026")).toBe(3);
        expect(passwordLevel("Boutique-2026!")).toBe(4);
    });
});

describe("PasswordStrength", () => {
    function render(password: string) {
        const fixture = TestBed.createComponent(PasswordStrength);
        fixture.componentRef.setInput("password", password);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    it("should show the hint before typing", () => {
        const el = render("");

        expect(el.textContent).toContain("Choisissez-en un solide");
        expect(el.querySelectorAll(".on").length).toBe(0);
        expect(el.querySelectorAll(".met").length).toBe(0);
    });

    it("should say when the password is too short", () => {
        expect(render("abc").textContent).toContain("Trop court");
    });

    it("should fill the bars and name the level", () => {
        const el = render("Boutique-2026!");

        expect(el.textContent).toContain("Excellent");
        expect(el.querySelectorAll(".on").length).toBe(4);
        expect(el.querySelectorAll(".met").length).toBe(4);
    });

    it("should tick only the criteria that are met", () => {
        const el = render("motdepasse1");
        const met = Array.from(el.querySelectorAll(".met")).map((li) => li.textContent);

        expect(met.length).toBe(2);
        expect(met[0]).toContain("8 caractères");
        expect(met[1]).toContain("chiffre");
    });
});
