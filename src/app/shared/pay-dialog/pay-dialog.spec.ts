import { Component, viewChild } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { PayChoice, PayDialog } from "./pay-dialog";

@Component({
    imports: [PayDialog],
    template: `<app-pay-dialog title="Encaisser" [due]="due" (confirmed)="choices.push($event)" />`,
})
class Host {
    due = 12000;
    choices: PayChoice[] = [];
    dialog = viewChild.required(PayDialog);
}

describe("PayDialog", () => {
    let host: Host;
    let el: HTMLElement;

    beforeEach(() => {
        const fixture = TestBed.createComponent(Host);
        fixture.detectChanges();
        host = fixture.componentInstance;
        el = fixture.nativeElement;
        host.dialog().open();
        fixture.detectChanges();
    });

    it("should start with the whole balance in cash", () => {
        expect(host.dialog().amount()).toBe(12000);
        expect(host.dialog().method()).toBe("CASH");
    });

    it("should offer the notes below the balance, then the balance", () => {
        expect(host.dialog().quickAmounts()).toEqual([2000, 5000, 10000]);
        expect(el.querySelector(".chip-balance")!.textContent).toContain("Solde");
    });

    it("should emit the choice when the amount is valid", () => {
        host.dialog().amount.set(5000);
        host.dialog().received.set(6000);
        host.dialog().submit();

        expect(host.choices).toEqual([{ method: "CASH", amount: 5000, received: 6000 }]);
        expect(host.dialog().change()).toBe(1000);
    });

    it("should refuse an amount above the balance", () => {
        host.dialog().amount.set(12001);
        host.dialog().submit();

        expect(host.choices.length).toBe(0);
        expect(host.dialog().formError()).toContain("12000");
    });

    it("should refuse a received amount below the payment", () => {
        host.dialog().amount.set(5000);
        host.dialog().received.set(4000);
        host.dialog().submit();

        expect(host.choices.length).toBe(0);
        expect(host.dialog().formError()).toContain("5000");
    });
});
