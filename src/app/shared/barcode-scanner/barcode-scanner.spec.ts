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

    it("à la lecture, montre le flash vert puis rend le code", async () => {
        vi.useFakeTimers();
        await TestBed.configureTestingModule({ imports: [BarcodeScanner] }).compileComponents();
        const fixture = TestBed.createComponent(BarcodeScanner);
        const el = fixture.nativeElement as HTMLElement;
        const scanned: string[] = [];
        fixture.componentInstance.scanned.subscribe((code) => scanned.push(code));
        el.querySelector("dialog")!.setAttribute("open", "");

        (fixture.componentInstance as unknown as { found(code: string): void }).found(" 611 ");
        fixture.detectChanges();

        expect(el.querySelector(".bs-flash")).not.toBeNull();
        expect(el.querySelector(".bs-ok")?.textContent).toContain("611");
        // pas encore rendu : le flash se voit d'abord
        expect(scanned).toEqual([]);

        vi.advanceTimersByTime(700);
        expect(scanned).toEqual(["611"]);
        vi.useRealTimers();
    });
});
