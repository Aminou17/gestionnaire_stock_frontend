import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ScanButton } from "./scan-button";

describe("ScanButton", () => {
    let fixture: ComponentFixture<ScanButton>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [ScanButton] }).compileComponents();
        fixture = TestBed.createComponent(ScanButton);
        fixture.detectChanges();
    });

    it("should show a labelled scan button", () => {
        const button = fixture.nativeElement.querySelector("button.scan") as HTMLButtonElement;
        expect(button.getAttribute("aria-label")).toBe("Scanner un code-barres");
    });

    it("should pass on the scanned code", () => {
        let code = "";
        fixture.componentInstance.scanned.subscribe((value) => (code = value));
        fixture.debugElement
            .query((el) => el.name === "app-barcode-scanner")
            .triggerEventHandler("scanned", "6111234567890");
        expect(code).toBe("6111234567890");
    });
});
