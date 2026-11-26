import { LIST_CONFIGS } from "./security-list.config";

describe("security list config", () => {
    it("should mark a suspicious address and show how many e-mails were tried", () => {
        const rows = LIST_CONFIGS.logins.toRows("ip", [
            {
                ip_address: "1.2.3.4",
                attempts: 8,
                emails: 3,
                shops: 0,
                last_attempt_at: "2026-11-20T10:00:00Z",
                suspicious: true,
            },
        ]);

        expect(rows[0].title).toBe("1.2.3.4");
        expect(rows[0].subtitle).toBe("3 adresses e-mail essayées");
        expect(rows[0].detail).toBe("8 échecs");
        expect(rows[0].badge?.label).toBe("Suspecte");
        expect(rows[0].shop).toBeNull();
    });

    it("should show when a locked account is released", () => {
        const until = new Date(Date.now() + 12 * 60_000).toISOString();
        const rows = LIST_CONFIGS.locked.toRows("", [
            {
                id: 1,
                name: "Adam",
                email: "adam@x.com",
                role: "manager",
                shop_name: "Chez Adam",
                failed_logins: 5,
                locked_until: until,
            },
        ]);

        expect(rows[0].badge?.label).toBe("Bloqué");
        expect(rows[0].note).toMatch(/^dans 1[12] min$/);
    });

    it("should tell denied accesses and password events apart", () => {
        const base = {
            id: 1,
            details: { path: "/reports/balance" },
            email: "m@x.com",
            user_name: null,
            ip_address: "::1",
            shop_name: null,
            created_at: "2026-11-20T10:00:00Z",
        };
        const [denied] = LIST_CONFIGS.events.toRows("denied", [
            { ...base, action: "ACCESS_DENIED", result: "FAILURE" },
        ]);
        const [changed] = LIST_CONFIGS.events.toRows("password", [
            { ...base, action: "PASSWORD_CHANGED", result: "SUCCESS" },
        ]);

        expect(denied.badge?.label).toBe("Refusé");
        expect(denied.subtitle).toBe("m@x.com · Rapports");
        expect(changed.title).toBe("Mot de passe changé");
        expect(changed.badge?.label).toBe("Réussi");
    });
});
