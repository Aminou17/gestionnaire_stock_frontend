import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { OpenCashDialog } from "./open-cash-dialog";

describe("OpenCashDialog", () => {
    let fixture: ComponentFixture<OpenCashDialog>;
    let el: HTMLElement;
    let httpMock: HttpTestingController;
    let dialog: HTMLDialogElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [OpenCashDialog],
            providers: [provideHttpClient(), provideHttpClientTesting()],
        }).compileComponents();

        fixture = TestBed.createComponent(OpenCashDialog);
        el = fixture.nativeElement;
        httpMock = TestBed.inject(HttpTestingController);
        await fixture.whenStable();

        // jsdom n'implémente pas showModal / close
        dialog = el.querySelector("dialog")!;
        dialog.showModal = function () {
            this.open = true;
        };
        dialog.close = function () {
            this.open = false;
        };
        fixture.componentInstance.open();
    });

    afterEach(() => httpMock.verify());

    async function typeAmount(value: string) {
        const input = el.querySelector<HTMLInputElement>("input")!;
        input.value = value;
        input.dispatchEvent(new Event("input"));
        await fixture.whenStable();
    }

    // un vrai clic sur le bouton : c'est ce chemin qui était bloqué par le (click) du <dialog>
    async function clickSubmit() {
        el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await fixture.whenStable();
    }

    it("should open the cash register with the typed amount, then close and notify", async () => {
        const opened = vi.fn();
        fixture.componentInstance.opened.subscribe(opened);

        await typeAmount("50000");
        await clickSubmit();

        const req = httpMock.expectOne("/api/cash_sessions/open");
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({ openingAmount: 50000 });
        req.flush({ id: 1 });
        await fixture.whenStable();

        expect(dialog.open).toBe(false);
        expect(opened).toHaveBeenCalled();
    });

    it("should keep the dialog open and show the API error", async () => {
        await typeAmount("50000");
        await clickSubmit();

        httpMock
            .expectOne("/api/cash_sessions/open")
            .flush(
                { message: "Une session de caisse existe déjà pour cette date." },
                { status: 409, statusText: "Conflict" },
            );
        await fixture.whenStable();

        expect(dialog.open).toBe(true);
        expect(el.querySelector('[role="alert"]')?.textContent).toContain(
            "Une session de caisse existe déjà",
        );
    });

    it("should refuse a negative amount without calling the API", async () => {
        await typeAmount("-100");
        await clickSubmit();

        httpMock.expectNone("/api/cash_sessions/open");
        expect(el.textContent).toContain("Le montant doit être positif ou nul.");
    });

    it("should close when clicking the backdrop but not inside the form", async () => {
        el.querySelector("form")!.click();
        expect(dialog.open).toBe(true);

        dialog.click();
        expect(dialog.open).toBe(false);
    });
});
