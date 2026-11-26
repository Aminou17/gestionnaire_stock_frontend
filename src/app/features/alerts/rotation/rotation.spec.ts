import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { Subject } from "rxjs";
import { provideRouter } from "@angular/router";

import { Rotation } from "./rotation";
import { SecurityAlertService } from "../../../core/audit/security-alert.service";
import { AuthService } from "../../../core/auth/auth.service";
import { ProductRotation } from "../../../core/stock/low-stock-alert.model";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { signal } from "@angular/core";

const bazin: ProductRotation = {
    id: 1,
    name: "Bazin riche bleu",
    category_name: "Tissus",
    theoretical_stock: 20,
    sold_last_30_days: 60,
    days_left: 10,
    speed: "FAST",
    last_sale_at: "2026-11-11T10:00:00.000Z",
    idle_days: 1,
    to_clear: false,
};
const pagne: ProductRotation = {
    id: 2,
    name: "Pagne wax",
    category_name: "Pagnes",
    theoretical_stock: 40,
    sold_last_30_days: 3,
    days_left: 400,
    speed: "SLOW",
    last_sale_at: "2026-11-02T10:00:00.000Z",
    idle_days: 10,
    to_clear: false,
};
const savon: ProductRotation = {
    id: 3,
    name: "Savon de Marseille",
    category_name: null,
    theoretical_stock: 50,
    sold_last_30_days: 0,
    days_left: null,
    speed: "DORMANT",
    last_sale_at: "2026-08-30T10:00:00.000Z",
    idle_days: 74,
    to_clear: true,
};

describe("Rotation", () => {
    let fixture: ComponentFixture<Rotation>;
    let source: Subject<ProductRotation[]>;

    const load = async (rows: ProductRotation[]) => {
        fixture = TestBed.createComponent(Rotation);
        TestBed.tick();
        source.next(rows);
        await fixture.whenStable();
        fixture.detectChanges();
    };

    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? "";

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                // La cloche de l'en-tête lit ce service, on évite ses requêtes
                {
                    provide: LowStockAlertService,
                    useValue: {
                        count: signal(0),
                        loading: signal(false),
                        failed: signal(false),
                        reload: () => {},
                        getRotation: () => source,
                    },
                },
                {
                    provide: SecurityAlertService,
                    useValue: {
                        count: signal(0),
                        loading: signal(false),
                        failed: signal(false),
                        latest: signal([]),
                        reload: () => {},
                    },
                },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(true),
                        isOwner: signal(false),
                        user: signal({
                            id: 1,
                            name: "Adam Ouédraogo",
                            email: "adam@test.com",
                            role: "admin",
                        }),
                        roleLabel: signal("Administrateur"),
                    },
                },
            ],
        });
        source = new Subject<ProductRotation[]>();
    });

    it("affiche les produits dans l'ordre reçu avec leur vitesse", async () => {
        await load([bazin, pagne, savon]);

        const rows = (fixture.nativeElement as HTMLElement).querySelectorAll(".row");
        expect(rows.length).toBe(3);
        expect(rows[0].textContent).toContain("Bazin riche bleu");
        expect(rows[0].textContent).toContain("Sort vite");
        expect(rows[2].textContent).toContain("Pas de vente");
    });

    it("colore la pastille de vitesse selon son sens", async () => {
        await load([bazin, pagne, savon]);

        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector(".row .speed.fast")!.textContent).toContain("Sort vite");
        expect(el.querySelector(".row .speed.slow")!.textContent).toContain("Sort lentement");
        expect(el.querySelector(".row .speed.clear")!.textContent).toContain("À solder");
    });

    it("rappelle la période de 30 jours, sans texte d'aide caché", async () => {
        await load([bazin, pagne, savon]);

        expect(text()).toContain("30 derniers jours");
        expect(
            (fixture.nativeElement as HTMLElement).querySelector(".intro, .filter-btn"),
        ).toBeNull();
    });

    it("affiche la photo du produit, sinon ses initiales", async () => {
        await load([{ ...bazin, image: "data:image/png;base64,AAAA" }, pagne, savon]);

        const thumbs = (fixture.nativeElement as HTMLElement).querySelectorAll(".row .thumb");
        expect(thumbs[0].querySelector("img")).not.toBeNull();
        expect(thumbs[1].textContent).toContain("PW");
    });

    it("liste les produits à solder et depuis quand ils ne se vendent plus", async () => {
        await load([bazin, pagne, savon]);
        const tab = [...fixture.nativeElement.querySelectorAll(".toolbar .chip")].find(
            (t: HTMLElement) => t.textContent!.includes("À solder"),
        ) as HTMLButtonElement;

        expect(tab.textContent).toContain("1");
        tab.click();
        await fixture.whenStable();

        const rows = (fixture.nativeElement as HTMLElement).querySelectorAll(".row");
        expect(rows.length).toBe(1);
        expect(rows[0].textContent).toContain("Savon de Marseille");
        expect(rows[0].textContent).toContain("À solder");
    });

    it("met en premier les produits qui risquent la rupture", async () => {
        await load([pagne, savon, bazin]);

        const rows = (fixture.nativeElement as HTMLElement).querySelectorAll(".row");
        expect(rows[0].textContent).toContain("Bazin riche bleu");
    });

    it("affiche plus d'un an au lieu d'un nombre de jours démesuré", async () => {
        await load([bazin, pagne, savon]);

        const rows = (fixture.nativeElement as HTMLElement).querySelectorAll(".row");
        expect(rows[0].querySelector(".days")!.textContent).toContain("10 j");
        expect(rows[1].querySelector(".days")!.textContent).toContain("plus d'un an");
    });

    it("signale les produits qui sortent vite avec moins de 14 jours de stock", async () => {
        await load([bazin, pagne, savon]);

        expect(text()).toContain("Bientôt en rupture");
        expect((fixture.nativeElement as HTMLElement).querySelector(".days.urgent")).not.toBeNull();
    });

    it("filtre par vitesse", async () => {
        await load([bazin, pagne, savon]);

        const tabs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
            ".toolbar .chip",
        );
        tabs[4].click();
        fixture.detectChanges();

        const rows = (fixture.nativeElement as HTMLElement).querySelectorAll(".row");
        expect(rows.length).toBe(1);
        expect(rows[0].textContent).toContain("Savon de Marseille");
    });

    it("retient l'onglet ouvert pour le retour depuis une fiche produit", async () => {
        await load([bazin, pagne, savon]);
        const rotation = fixture.componentInstance;
        expect(rotation.backState().backTo).toBe("/alerts/rotation");

        rotation.view.set("DORMANT");

        expect(rotation.backState()).toEqual({
            backTo: "/alerts/rotation?vue=inactifs",
            backLabel: "Rotation",
        });
    });

    it("propose de réessayer quand le chargement échoue", async () => {
        fixture = TestBed.createComponent(Rotation);
        TestBed.tick();
        source.error(new HttpErrorResponse({ status: 500 }));
        await fixture.whenStable();
        fixture.detectChanges();

        expect(text()).toContain("Impossible de charger la vitesse de vente.");
    });
});
