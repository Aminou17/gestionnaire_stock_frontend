import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { provideRouter } from "@angular/router";

import { Notifications } from "./notifications";
import { AuditLog } from "../../core/audit/audit-log.model";
import { SecurityAlertService } from "../../core/audit/security-alert.service";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";

const failedLogin: AuditLog = {
    id: 1,
    user_id: null,
    user_name: null,
    action: "AUTH_LOGIN_FAILED",
    entity_type: "user",
    entity_id: null,
    details: { attemptedEmail: "intrus@test.com" },
    result: "FAILURE",
    ip_address: "203.0.113.9",
    created_at: "2026-01-10T09:00:00Z",
};

describe("Notifications", () => {
    let fixture: ComponentFixture<Notifications>;
    let el: HTMLElement;
    let reload: ReturnType<typeof vi.fn>;

    async function render(
        stock: number,
        failures: AuditLog[],
        state: { failed?: boolean; loading?: boolean } = {},
    ) {
        reload = vi.fn();

        await TestBed.configureTestingModule({
            imports: [Notifications],
            providers: [
                provideRouter([]),
                {
                    provide: LowStockAlertService,
                    useValue: {
                        count: signal(stock),
                        list: signal(
                            Array.from({ length: stock }, (_, i) => ({
                                id: i + 1,
                                name: `Produit ${i + 1}`,
                                theoretical_stock: i === 0 ? 0 : 2,
                                min_stock: 5,
                                status: i === 0 ? "OUT_OF_STOCK" : "LOW",
                            })),
                        ),
                        failed: signal(false),
                        loading: signal(false),
                        reload: vi.fn(),
                    },
                },
                {
                    provide: SecurityAlertService,
                    useValue: {
                        count: signal(failures.length),
                        latest: signal(failures),
                        failed: signal(state.failed ?? false),
                        loading: signal(state.loading ?? false),
                        reload,
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Notifications);
        el = fixture.nativeElement;
        await fixture.whenStable();
    }

    const text = () => el.textContent!.replace(/\s+/g, " ");
    const toggle = async () => {
        el.querySelector<HTMLButtonElement>(".icon-btn")!.click();
        await fixture.whenStable();
    };

    it("should count stock alerts and security failures on the bell", async () => {
        await render(3, [failedLogin]);

        expect(el.querySelector(".dot")?.textContent).toBe("4");
    });

    it("should show no badge when all is fine", async () => {
        await render(0, []);

        expect(el.querySelector(".dot")).toBeNull();
    });

    it("should open the panel with both sections and refresh the failures", async () => {
        await render(2, [failedLogin]);
        await toggle();

        expect(text()).toContain("Produit 1 Rupture de stock");
        expect(text()).toContain("Produit 2 Stock : 2 sur 5");
        expect(text()).toContain("Connexion échouée · intrus@test.com");
        expect(el.querySelector("a[href='/alerts']")).not.toBeNull();
        expect(el.querySelector("a[href='/audit-logs?result=FAILURE']")).not.toBeNull();
        expect(reload).toHaveBeenCalled();
    });

    it("should say so when nothing needs attention", async () => {
        await render(0, []);
        await toggle();

        expect(text()).toContain("Tout est à jour");
    });

    it("should close on an outside click and on Escape", async () => {
        await render(0, []);
        await toggle();
        document.body.click();
        await fixture.whenStable();
        expect(el.querySelector(".panel")).toBeNull();

        await toggle();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        await fixture.whenStable();
        expect(el.querySelector(".panel")).toBeNull();
    });

    it("should not say all is fine when the failures cannot be loaded", async () => {
        await render(0, [], { failed: true });
        await toggle();

        expect(text()).toContain("Échecs du jour indisponibles.");
        expect(text()).not.toContain("Aucun échec aujourd'hui.");

        el.querySelector<HTMLButtonElement>(".retry")!.click();
        expect(reload).toHaveBeenCalledTimes(2);
    });

    it("should not say all is fine while loading", async () => {
        await render(0, [], { loading: true });
        await toggle();

        expect(el.querySelector(".skeleton-row")).not.toBeNull();
        expect(text()).not.toContain("Aucun échec aujourd'hui.");
        expect(text()).not.toContain("Tout est à jour");
    });

    it("should close with the close button", async () => {
        await render(0, []);
        await toggle();
        el.querySelector<HTMLButtonElement>(".close")!.click();
        await fixture.whenStable();

        expect(el.querySelector(".panel")).toBeNull();
    });

    it("should merge identical failures in a row", async () => {
        await render(0, [failedLogin, { ...failedLogin, id: 2 }]);
        await toggle();

        expect(el.querySelectorAll(".item").length).toBe(1);
        expect(text()).toContain("Connexion échouée · intrus@test.com ×2");
    });
});
