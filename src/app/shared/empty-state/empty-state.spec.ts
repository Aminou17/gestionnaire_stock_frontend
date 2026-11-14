import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { EmptyState } from "./empty-state";

@Component({
    imports: [EmptyState],
    template: `
        <app-empty-state icon="cart" title="Rien ici" text="Un petit texte.">
            <button type="button">Agir</button>
        </app-empty-state>
        <app-empty-state icon="alert" tone="danger" title="Sans texte" />
    `,
})
class Host {}

describe("EmptyState", () => {
    it("should show the title, the text and the projected action", async () => {
        const fixture = TestBed.createComponent(Host);
        await fixture.whenStable();
        const states = fixture.nativeElement.querySelectorAll(".empty-state");

        expect(states[0].querySelector("h3").textContent).toBe("Rien ici");
        expect(states[0].querySelector("p").textContent).toBe("Un petit texte.");
        expect(states[0].querySelector("button").textContent).toBe("Agir");
    });

    it("should not render a text paragraph when there is none", async () => {
        const fixture = TestBed.createComponent(Host);
        await fixture.whenStable();
        const second = fixture.nativeElement.querySelectorAll(".empty-state")[1];

        expect(second.querySelector("p")).toBeNull();
        expect(second.querySelector(".tone-danger")).not.toBeNull();
    });
});
