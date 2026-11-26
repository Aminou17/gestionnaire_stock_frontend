import { TestBed } from "@angular/core/testing";

import { ModuleAccess, ModuleStore, moduleOfPath } from "./module-access";

describe("module access", () => {
    it("should know which access each page depends on", () => {
        expect(moduleOfPath("/customers")).toBe("customers");
        expect(moduleOfPath("/customers/17")).toBe("customers");
        expect(moduleOfPath("/expenses/new")).toBe("expenses");
        expect(moduleOfPath("/alerts/rotation")).toBe("alerts_pro");
        expect(moduleOfPath("/alerts/supplier/4?x=1")).toBe("alerts_pro");
        expect(moduleOfPath("/settings/export")).toBe("exports");
    });

    it("should leave the always included pages open", () => {
        for (const path of [
            "/dashboard",
            "/sales/new",
            "/products",
            "/cash",
            "/alerts",
            "/settings/shop",
        ]) {
            expect(moduleOfPath(path)).toBeNull();
        }
    });

    it("should not mistake a close prefix for an access", () => {
        expect(moduleOfPath("/customersx")).toBeNull();
        expect(moduleOfPath("/users-list")).toBeNull();
    });

    it("should allow everything until the owner removes an access", () => {
        const access = TestBed.inject(ModuleAccess);

        expect(access.allows("customers")).toBe(true);
        expect(access.allowsPath("/audit-logs")).toBe(true);

        TestBed.inject(ModuleStore).disabled.set(["audit", "exports"]);

        expect(access.allows("audit")).toBe(false);
        expect(access.allowsPath("/audit-logs")).toBe(false);
        expect(access.allowsPath("/sales")).toBe(true);
        // Un lien relatif des réglages
        expect(access.allowsPath("export")).toBe(false);
        expect(access.allowsPath("alert-email")).toBe(true);
        expect(access.allowsPath(undefined)).toBe(true);
    });
});
