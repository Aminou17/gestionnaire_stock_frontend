import { TestBed } from "@angular/core/testing";

import { BarcodeScanner } from "./barcode-scanner";

describe("BarcodeScanner", () => {
    beforeEach(() => {
        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute("open", "");
        };
        HTMLDialogElement.prototype.close = function () {
            this.removeAttribute("open");
        };
    });

    it("sans caméra, explique et laisse saisir le code à la main", async () => {
        await TestBed.configureTestingModule({ imports: [BarcodeScanner] }).compileComponents();
        const fixture = TestBed.createComponent(BarcodeScanner);
        const el = fixture.nativeElement as HTMLElement;
        const scanned: string[] = [];
        fixture.componentInstance.scanned.subscribe((code) => scanned.push(code));

        // jsdom n'a pas de caméra
        await fixture.componentInstance.start();
        await fixture.whenStable();
        expect(el.querySelector(".bs-error")?.textContent).toContain("Saisissez le code");

        const input = el.querySelector<HTMLInputElement>(".bs-manual input")!;
        input.value = " 6111245781234 ";
        input.dispatchEvent(new Event("input"));
        el.querySelector<HTMLFormElement>(".bs-manual")!.dispatchEvent(new Event("submit"));

        expect(scanned).toEqual(["6111245781234"]);
        expect(el.querySelector("dialog")!.open).toBe(false);
    });
});
