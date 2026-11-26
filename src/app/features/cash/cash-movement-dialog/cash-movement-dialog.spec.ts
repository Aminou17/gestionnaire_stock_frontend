import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CashMovementDialog } from "./cash-movement-dialog";

describe("CashMovementDialog", () => {
    let fixture: ComponentFixture<CashMovementDialog>;
    let el: HTMLElement;
    let httpMock: HttpTestingController;
    let dialog: HTMLDialogElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CashMovementDialog],
            providers: [provideHttpClient(), provideHttpClientTesting()],
        }).compileComponents();

        fixture = TestBed.createComponent(CashMovementDialog);
        el = fixture.nativeElement;
        httpMock = TestBed.inject(HttpTestingController);
        await fixture.whenStable();

        // Jsdom n'implémente pas showModal / close
        dialog = el.querySelector("dialog")!;
        dialog.showModal = function () {
            this.open = true;
        };
        dialog.close = function () {
            this.open = false;
        };
    });

    afterEach(() => httpMock.verify());

    async function typeAmount(value: string) {
        const input = el.querySelector<HTMLInputElement>('input[type="number"]')!;
        input.value = value;
        input.dispatchEvent(new Event("input"));
        await fixture.whenStable();
    }

    async function chooseReason(value: string) {
        const select = el.querySelector<HTMLSelectElement>("select")!;
        select.value = value;
        select.dispatchEvent(new Event("change"));
        await fixture.whenStable();
    }

    async function typeDetail(value: string) {
        const input = el.querySelector<HTMLInputElement>('input[type="text"]')!;
        input.value = value;
        input.dispatchEvent(new Event("input"));
        await fixture.whenStable();
    }

    async function clickSubmit() {
        el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await fixture.whenStable();
    }

    const options = () =>
        [...el.querySelectorAll("option")].map((option) => option.textContent!.trim());

    it("should show the title and the reasons of the chosen movement", async () => {
        fixture.componentInstance.open("EXPENSE");
        await fixture.whenStable();
        expect(el.querySelector("h2")?.textContent).toBe("Enregistrer une dépense");
        expect(options()).toContain("Transport");
        expect(options()).not.toContain("Dépôt à la banque");

        fixture.componentInstance.open("WITHDRAWAL");
        await fixture.whenStable();
        expect(el.querySelector("h2")?.textContent).toBe("Retirer de l'argent");
        expect(options()).toContain("Dépôt à la banque");
    });

    it("should save the movement with its reason, then close and notify", async () => {
        const saved = vi.fn();
        fixture.componentInstance.saved.subscribe(saved);
        fixture.componentInstance.open("EXPENSE");
        await typeAmount("2500");
        await chooseReason("TRANSPORT");
        await typeDetail("  Taxi pour le tissu  ");
        await clickSubmit();

        const req = httpMock.expectOne("/api/cash_movements");
        expect(req.request.body).toEqual({
            type: "EXPENSE",
            amount: 2500,
            category: "TRANSPORT",
            reason: "Taxi pour le tissu",
        });
        req.flush({ id: 1 });
        await fixture.whenStable();

        expect(dialog.open).toBe(false);
        expect(saved).toHaveBeenCalled();
    });

    it("should always require the detail, even with a reason from the list", async () => {
        fixture.componentInstance.open("DEPOSIT");
        await typeAmount("1000");
        await chooseReason("CHANGE");
        await clickSubmit();

        httpMock.expectNone("/api/cash_movements");
        expect(el.textContent).toContain("Précisez la raison du mouvement.");
    });

    it("should let the reason from the list be left out", async () => {
        fixture.componentInstance.open("DEPOSIT");
        await typeAmount("1000");
        await typeDetail("Monnaie donnée par la employée");
        await clickSubmit();

        const req = httpMock.expectOne("/api/cash_movements");
        expect(req.request.body).toEqual({
            type: "DEPOSIT",
            amount: 1000,
            reason: "Monnaie donnée par la employée",
        });
        req.flush({ id: 1 });
    });

    it("should not require the detail for a withdrawal", async () => {
        fixture.componentInstance.open("WITHDRAWAL");
        await typeAmount("1000");
        await clickSubmit();

        const req = httpMock.expectOne("/api/cash_movements");
        expect(req.request.body).toEqual({ type: "WITHDRAWAL", amount: 1000, reason: "" });
        req.flush({ id: 1 });
    });

    it("should refuse a zero amount without calling the API", async () => {
        fixture.componentInstance.open("EXPENSE");
        await typeAmount("0");
        await chooseReason("FOOD");
        await clickSubmit();

        httpMock.expectNone("/api/cash_movements");
        expect(el.textContent).toContain("Le montant doit être un nombre entier supérieur à 0.");
    });

    it("should keep the dialog open and show the API error", async () => {
        fixture.componentInstance.open("EXPENSE");
        await typeAmount("500");
        await chooseReason("FOOD");
        await typeDetail("Repas");
        await clickSubmit();

        httpMock
            .expectOne("/api/cash_movements")
            .flush(
                { message: "Aucune session de caisse ouverte aujourd'hui." },
                { status: 409, statusText: "Conflict" },
            );
        await fixture.whenStable();

        expect(dialog.open).toBe(true);
        expect(el.querySelector('[role="alert"]')?.textContent).toContain("Aucune session");
    });
});
