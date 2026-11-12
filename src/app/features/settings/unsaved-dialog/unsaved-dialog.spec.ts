import { ComponentFixture, TestBed } from "@angular/core/testing";

import { UnsavedDialog } from "./unsaved-dialog";

describe("UnsavedDialog", () => {
    let fixture: ComponentFixture<UnsavedDialog>;
    let el: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [UnsavedDialog] }).compileComponents();

        fixture = TestBed.createComponent(UnsavedDialog);
        el = fixture.nativeElement;
        await fixture.whenStable();

        // jsdom ne gère pas showModal et close
        const dialog = el.querySelector("dialog")!;
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();
    });

    const button = (label: string) =>
        [...el.querySelectorAll("button")].find((b) => b.textContent!.includes(label))!;

    it("should ask a question and resolve true when the user leaves", async () => {
        const answer = fixture.componentInstance.ask();

        button("Quitter").click();

        expect(await answer).toBe(true);
        expect(el.textContent).toContain("Quitter sans enregistrer ?");
    });

    it("should resolve false when the user stays", async () => {
        const answer = fixture.componentInstance.ask();

        button("Rester sur la page").click();

        expect(await answer).toBe(false);
    });

    it("should stay on the page when the dialog is dismissed with Escape", async () => {
        const answer = fixture.componentInstance.ask();

        el.querySelector("dialog")!.dispatchEvent(new Event("cancel", { cancelable: true }));

        expect(await answer).toBe(false);
    });
});
