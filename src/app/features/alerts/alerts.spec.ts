import { HttpErrorResponse } from "@angular/common/http";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { provideRouter } from "@angular/router";

import { of, throwError } from "rxjs";

import { Alerts } from "./alerts";
import { AuthService } from "../../core/auth/auth.service";
import {
    LowStockAlert,
    ProductRotation,
    SnoozedAlert,
} from "../../core/stock/low-stock-alert.model";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { ProductService } from "../../core/stock/product.service";

const tissu: LowStockAlert = {
    id: 1,
    name: "Bazin riche bleu",
    category_id: 1,
    category_name: "Tissus",
    supplier_id: 1,
    supplier_name: "Ets Diallo",
    supplier_contact: "Mireille Mavoungou",
    supplier_phone: "06 612 34 56",
    last_entry_at: null,
    last_entry_quantity: null,
    theoretical_stock: 0,
    min_stock: 5,
    sold_last_30_days: 0,
    days_left: null,
    status: "OUT_OF_STOCK",
    suggested_quantity: 10,
};
const pagne: LowStockAlert = {
    id: 2,
    name: "Pagne wax",
    category_id: 2,
    category_name: "Pagnes",
    supplier_id: 2,
    supplier_name: "Grossiste Kone",
    supplier_contact: null,
    supplier_phone: null,
    last_entry_at: null,
    last_entry_quantity: null,
    theoretical_stock: 3,
    min_stock: 5,
    sold_last_30_days: 9,
    days_left: 10,
    status: "LOW",
    suggested_quantity: 7,
};

describe("Alerts", () => {
    let fixture: ComponentFixture<Alerts>;
    let el: HTMLElement;
    let reload: ReturnType<typeof vi.fn>;
    let snooze: ReturnType<typeof vi.fn>;
    let updateProduct: ReturnType<typeof vi.fn>;
    let snoozedItems: SnoozedAlert[] = [];
    let rotationItems: Partial<ProductRotation>[] = [];

    async function render(
        state: { value?: LowStockAlert[]; error?: HttpErrorResponse },
        role: "admin" | "manager" = "admin",
    ) {
        reload = vi.fn();
        snooze = vi.fn(() => of({}));
        updateProduct = vi.fn(() => of({}));

        await TestBed.configureTestingModule({
            imports: [Alerts],
            providers: [
                provideRouter([]),
                {
                    provide: LowStockAlertService,
                    useValue: {
                        count: signal(state.value?.length ?? 0),
                        reload,
                        snoozedList: signal(snoozedItems),
                        snooze,
                        getRotation: () => of(rotationItems),
                        alerts: {
                            isLoading: () => false,
                            hasValue: () => !!state.value,
                            value: () => state.value,
                            error: () => state.error,
                            reload,
                        },
                    },
                },
                { provide: ProductService, useValue: { updateProduct } },
                {
                    provide: AuthService,
                    useValue: {
                        isAdmin: signal(role === "admin"),
                        isOwner: signal(false),
                        user: signal({
                            id: 1,
                            name: "Awa Bazin",
                            email: "awa@test.com",
                            role,
                        }),
                        roleLabel: signal("Administrateur"),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Alerts);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, " ");

    it("should list the products with their status and counters", async () => {
        await render({ value: [tissu, pagne] });

        expect(text()).toContain("Tous 2");
        expect(text()).toContain("En rupture 1");
        expect(text()).toContain("Stock faible 1");
        expect(text()).toContain("Bazin riche bleu");
        expect(text()).toContain("Pagne wax");
    });

    it("should show the suggested quantity and prefill it in the restock link", async () => {
        await render({ value: [tissu, pagne] });
        const rows = el.querySelectorAll(".row");

        expect(rows[0].querySelector(".order")!.textContent).toContain("10");
        expect(rows[1].querySelector(".order")!.textContent).toContain("7");
        expect(rows[1].querySelector<HTMLAnchorElement>(".restock")!.href).toContain(
            "productId=2&quantity=7",
        );
    });

    it("should show no supplier and no order menu to the manager", async () => {
        const hidden = {
            supplier_id: null,
            supplier_name: null,
            supplier_contact: null,
            supplier_phone: null,
        };
        await render(
            {
                value: [
                    { ...tissu, ...hidden },
                    { ...pagne, ...hidden },
                ],
            },
            "manager",
        );

        expect(text()).toContain("Bazin riche bleu");
        expect(el.querySelector(".group-head")).toBeNull();
        expect(el.querySelector(".order-btn")).toBeNull();
        expect(el.querySelector("select[aria-label='Fournisseur']")).toBeNull();
    });

    it("should point to the products to clear when some stock no longer sells", async () => {
        rotationItems = [
            { id: 9, to_clear: true },
            { id: 10, to_clear: false },
        ];
        await render({ value: [tissu] });

        const link = el.querySelector<HTMLAnchorElement>(".clear-link")!;
        expect(link.textContent).toContain("À solder : 1 produit sans vente depuis 60 jours");
        expect(link.href).toContain("/alerts/rotation?vue=solder");
        rotationItems = [];
    });

    // jours restants et dernière entrée sont dans le menu de la ligne
    async function openRowMenu(index: number) {
        el.querySelectorAll<HTMLButtonElement>(".more-btn")[index].click();
        await fixture.whenStable();
        return el.querySelector(".menu-panel .sheet-info")!;
    }

    it("should show the days left in the row menu only when there are sales", async () => {
        await render({ value: [tissu, pagne] });

        expect((await openRowMenu(0)).querySelector(".days-left")).toBeNull();
        expect((await openRowMenu(1)).querySelector(".days-left")!.textContent).toContain("10 j");
    });

    it("should group the products by supplier with a link to the order page", async () => {
        await render({ value: [tissu, pagne] });
        const heads = el.querySelectorAll(".group-head");

        expect(heads.length).toBe(2);
        expect(heads[0].textContent).toContain("Ets Diallo");
        expect(heads[0].textContent).toContain("Mireille Mavoungou");
        expect(heads[0].querySelector<HTMLAnchorElement>(".order-btn")!.getAttribute("href")).toBe(
            "/alerts/supplier/1",
        );
        expect(
            heads[0].querySelector<HTMLAnchorElement>("a.group-name")!.getAttribute("href"),
        ).toBe("/alerts/supplier/1");
        expect(heads[1].querySelector<HTMLAnchorElement>(".order-btn")!.getAttribute("href")).toBe(
            "/alerts/supplier/2",
        );
    });

    it("should put the products without supplier at the end", async () => {
        await render({
            value: [{ ...tissu, supplier_id: null, supplier_name: null }, pagne],
        });
        const names = [...el.querySelectorAll(".group-name")].map((n) => n.textContent!.trim());

        expect(names).toEqual(["Grossiste Kone", "Sans fournisseur"]);
    });

    it("should show when the product was last restocked in the row menu", async () => {
        const recent = new Date(Date.now() - 12 * 86_400_000).toISOString();
        await render({
            value: [{ ...tissu, last_entry_at: recent, last_entry_quantity: 20 }, pagne],
        });

        expect((await openRowMenu(0)).querySelector(".last-entry")!.textContent).toContain(
            "il y a 12 jours (+20)",
        );
        expect((await openRowMenu(1)).querySelector(".last-entry")!.textContent).toContain(
            "Jamais réapprovisionné",
        );
    });

    it("should say the status in words, not only in color", async () => {
        await render({ value: [tissu, pagne] });
        const rows = el.querySelectorAll(".row");

        expect(rows[0].querySelector(".status")!.textContent).toContain("En rupture");
        expect(rows[1].querySelector(".status")!.textContent).toContain("3 en stock");
    });

    it("should mark the urgency on each row and show the figures as pills", async () => {
        await render({ value: [tissu, pagne] });
        const rows = el.querySelectorAll(".row");

        expect(rows[0].classList.contains("out")).toBe(true);
        expect(rows[1].classList.contains("out")).toBe(false);
        expect(rows[1].querySelector(".status")!.textContent).toContain("en stock");
        expect(rows[0].querySelector(".order")!.textContent).toContain("À commander");
    });

    it("should show the three counters with their count and a pressed state", async () => {
        await render({ value: [tissu, pagne] });
        const tabs = el.querySelectorAll<HTMLButtonElement>(".chips .chip");

        expect(tabs.length).toBe(3);
        expect(tabs[0].textContent).toContain("2");
        expect(tabs[0].getAttribute("aria-pressed")).toBe("true");
        expect(tabs[1].getAttribute("aria-pressed")).toBe("false");
    });

    it("should not show any cost", async () => {
        await render({ value: [tissu, pagne] });

        expect(text()).not.toContain("Coût d'achat");
        expect(el.querySelector(".export")).toBeNull();
    });

    it("should filter on the out of stock products", async () => {
        await render({ value: [tissu, pagne] });
        el.querySelector<HTMLButtonElement>(".chip-out")!.click();
        await fixture.whenStable();

        expect(text()).toContain("Bazin riche bleu");
        expect(text()).not.toContain("Pagne wax");
    });

    it("should show every product again when the active counter is pressed twice", async () => {
        await render({ value: [tissu, pagne] });
        const out = el.querySelector<HTMLButtonElement>(".chip-out")!;
        out.click();
        await fixture.whenStable();
        expect(out.getAttribute("aria-pressed")).toBe("true");

        out.click();
        await fixture.whenStable();

        expect(out.getAttribute("aria-pressed")).toBe("false");
        expect(text()).toContain("Pagne wax");
    });

    it("should filter on the low stock products", async () => {
        await render({ value: [tissu, pagne] });
        el.querySelector<HTMLButtonElement>(".chip-low")!.click();
        await fixture.whenStable();

        expect(text()).toContain("Pagne wax");
        expect(text()).not.toContain("Bazin riche bleu");
    });

    it("should say when a category is empty", async () => {
        await render({ value: [pagne] });
        el.querySelector<HTMLButtonElement>(".chip-out")!.click();
        await fixture.whenStable();

        expect(text()).toContain("Aucun produit ne correspond à ces filtres.");
    });

    it("should remember the tab and the filters for the way back from a product", async () => {
        await render({ value: [tissu, pagne] });
        const alerts = fixture.componentInstance;
        expect(alerts.backState()).toEqual({ backTo: "/alerts", backLabel: "Alertes" });

        alerts.view.set("out");
        alerts.search.set("bazin");
        alerts.supplierId.set("1");

        expect(alerts.backState().backTo).toBe("/alerts?vue=out&q=bazin&fournisseur=1");
    });

    it("should show the category under the name", async () => {
        await render({ value: [tissu] });

        expect(el.querySelector(".meta")!.textContent).toContain("Tissus");
    });

    it("should count the active filters on the Filtres button", async () => {
        await render({ value: [tissu, pagne] });
        const button = el.querySelector<HTMLButtonElement>(".filter-btn")!;
        expect(button.querySelector(".filter-count")).toBeNull();

        const supplier = el.querySelector<HTMLSelectElement>("select")!;
        supplier.value = "1";
        supplier.dispatchEvent(new Event("change"));
        button.click();
        await fixture.whenStable();

        expect(button.querySelector(".filter-count")!.textContent).toContain("1");
        expect(el.querySelector(".filters")!.classList).toContain("open");
    });

    it("should search a product without caring about accents or case", async () => {
        await render({ value: [tissu, pagne] });
        const input = el.querySelector<HTMLInputElement>(".search input")!;
        input.value = "PAGNE";
        input.dispatchEvent(new Event("input"));
        await fixture.whenStable();

        expect(text()).toContain("Pagne wax");
        expect(text()).not.toContain("Bazin riche bleu");
    });

    it("should filter on a supplier and on a category", async () => {
        await render({ value: [tissu, pagne] });
        const [supplier, category] = Array.from(el.querySelectorAll<HTMLSelectElement>("select"));

        supplier.value = "1";
        supplier.dispatchEvent(new Event("change"));
        await fixture.whenStable();
        expect(text()).toContain("Bazin riche bleu");
        expect(text()).not.toContain("Pagne wax");

        category.value = "2";
        category.dispatchEvent(new Event("change"));
        await fixture.whenStable();
        expect(text()).toContain("Aucun produit ne correspond à ces filtres.");

        el.querySelector<HTMLButtonElement>(".empty button")!.click();
        await fixture.whenStable();
        expect(text()).toContain("Pagne wax");
    });

    it("should tell the manager to warn the owner", async () => {
        await render({ value: [pagne] }, "manager");

        expect(el.querySelector(".note")?.textContent).toContain("prévenez l'administrateur");
        expect(el.querySelector(".list-card")!.firstElementChild!.classList).not.toContain("note");
    });

    it("should change the threshold of a product from its row", async () => {
        await render({ value: [pagne] });
        await openRowMenu(0);
        el.querySelector<HTMLButtonElement>(".edit-threshold")!.click();
        await fixture.whenStable();

        const input = el.querySelector<HTMLInputElement>(".threshold-input")!;
        input.value = "8";
        input.dispatchEvent(new Event("input"));
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await fixture.whenStable();

        expect(updateProduct).toHaveBeenCalledWith(2, { minStock: 8 });
        expect(reload).toHaveBeenCalled();
    });

    it("should refuse an invalid threshold without calling the API", async () => {
        await render({ value: [pagne] });
        await openRowMenu(0);
        el.querySelector<HTMLButtonElement>(".edit-threshold")!.click();
        await fixture.whenStable();

        const input = el.querySelector<HTMLInputElement>(".threshold-input")!;
        input.value = "-2";
        input.dispatchEvent(new Event("input"));
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await fixture.whenStable();

        expect(updateProduct).not.toHaveBeenCalled();
        expect(text()).toContain("Le seuil doit être un nombre entier");
    });

    async function snoozeFor(days: number) {
        el.querySelector<HTMLButtonElement>(".more-btn")!.click();
        await fixture.whenStable();
        const options = [...el.querySelectorAll<HTMLButtonElement>(".snooze-option")];
        options.find((o) => o.textContent!.includes(`${days} jours`))!.click();
        await fixture.whenStable();
    }

    it("should snooze an alert for the chosen number of days", async () => {
        await render({ value: [pagne] });
        await snoozeFor(30);

        expect(snooze).toHaveBeenCalledWith(2, 30);
        expect(reload).toHaveBeenCalled();
        expect(el.querySelector(".menu-panel")).toBeNull();
    });

    it("should let the owner undo a snooze right away", async () => {
        await render({ value: [pagne] });
        await snoozeFor(7);

        expect(el.querySelector(".notice")!.textContent).toContain("en sourdine pour 7 jours");

        el.querySelector<HTMLButtonElement>(".notice button")!.click();
        await fixture.whenStable();

        expect(snooze).toHaveBeenLastCalledWith(2, null);
        expect(el.querySelector(".notice")).toBeNull();
    });

    it("should show the error and no notice when the snooze fails", async () => {
        await render({ value: [pagne] });
        snooze.mockReturnValueOnce(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 404,
                        error: { message: "Produit introuvable ou désactivé." },
                    }),
            ),
        );
        await snoozeFor(30);

        expect(el.querySelector(".notice")).toBeNull();
        expect(text()).toContain("Produit introuvable ou désactivé.");
    });

    it("should close the row menu with its close button", async () => {
        await render({ value: [pagne] });
        el.querySelector<HTMLButtonElement>(".more-btn")!.click();
        await fixture.whenStable();
        el.querySelector<HTMLButtonElement>(".sheet-close")!.click();
        await fixture.whenStable();

        expect(el.querySelector(".menu-panel")).toBeNull();
    });

    it("should open the threshold field from the row menu", async () => {
        await render({ value: [pagne] });
        el.querySelector<HTMLButtonElement>(".more-btn")!.click();
        await fixture.whenStable();
        el.querySelector<HTMLButtonElement>(".edit-threshold")!.click();
        await fixture.whenStable();

        expect(el.querySelector(".threshold-input")).not.toBeNull();
        expect(el.querySelector(".menu-panel")).toBeNull();
    });

    it("should close the menu on Escape and on a click elsewhere", async () => {
        await render({ value: [pagne] });
        const open = async () => {
            el.querySelector<HTMLButtonElement>(".more-btn")!.click();
            await fixture.whenStable();
        };

        await open();
        expect(el.querySelector(".menu-panel")).not.toBeNull();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        await fixture.whenStable();
        expect(el.querySelector(".menu-panel")).toBeNull();

        await open();
        document.body.click();
        await fixture.whenStable();
        expect(el.querySelector(".menu-panel")).toBeNull();
    });

    it("should list the snoozed alerts and let the owner resume one", async () => {
        snoozedItems = [
            {
                id: 5,
                name: "Bazin brodé du Mali",
                theoretical_stock: 1,
                snoozed_until: "2026-12-15T10:00:00.000Z",
            },
        ];
        await render({ value: [pagne] });

        expect(text()).toContain("En sourdine (1)");
        expect(text()).toContain("Bazin brodé du Mali");

        el.querySelector<HTMLButtonElement>(".snoozed-row button")!.click();
        await fixture.whenStable();

        expect(snooze).toHaveBeenCalledWith(5, null);
        snoozedItems = [];
    });

    it("should hide the threshold edit and the snooze from the manager", async () => {
        await render({ value: [pagne] }, "manager");

        expect(el.querySelector(".edit-threshold")).toBeNull();
        expect(el.querySelector(".more-btn")).toBeNull();
        expect(text()).not.toContain("En sourdine");
    });

    it("should hide the restock link from the manager", async () => {
        expect(text()).toContain("Pagne wax");
        expect(el.querySelector(".restock")).toBeNull();
    });

    it("should link each product to a restock entry", async () => {
        await render({ value: [pagne] });

        const link = el.querySelector<HTMLAnchorElement>(".restock")!;
        expect(link.getAttribute("href")).toBe("/stock-entries/new?productId=2&quantity=7");
    });

    it("should say all is fine when nothing is under its threshold", async () => {
        await render({ value: [] });

        expect(text()).toContain("Tout est en ordre");
    });

    it("should send to the settings when the general threshold is missing", async () => {
        await render({
            error: new HttpErrorResponse({
                status: 409,
                error: { message: "Veuillez configurer le seuil général de stock." },
            }),
        });

        expect(text()).toContain("Veuillez configurer le seuil général");
        expect(el.querySelector("a[href='/settings/stock']")).not.toBeNull();
        expect(el.querySelector(".empty button")).toBeNull();
        expect(el.querySelector(".stats")).toBeNull();
    });

    it("should offer to retry on another error", async () => {
        await render({ error: new HttpErrorResponse({ status: 500 }) });
        el.querySelector<HTMLButtonElement>(".empty button")!.click();

        expect(text()).toContain("Impossible de charger les alertes.");
        expect(reload).toHaveBeenCalled();
    });

    it("should show the photo of the product, or its initials without one", async () => {
        await render({
            value: [{ ...tissu, image: "data:image/png;base64,AAAA" }, pagne],
        });
        const rows = el.querySelectorAll(".row");

        expect(rows[0].querySelector(".thumb img")).not.toBeNull();
        expect(rows[1].querySelector(".thumb img")).toBeNull();
        expect(rows[1].querySelector(".thumb")!.textContent!.trim()).toMatch(/^[A-Z]{2}$/);
    });
});
