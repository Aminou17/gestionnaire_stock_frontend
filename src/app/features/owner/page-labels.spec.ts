import { accessAttempt, pageLabel, roleLabel } from "./page-labels";

describe("page labels", () => {
    it("should name the pages the way the menu does", () => {
        expect(pageLabel("/sales/new")).toBe("Nouvelle vente");
        expect(pageLabel("/customers")).toBe("Clients et crédits");
        expect(pageLabel("/customers/:id")).toBe("Fiche d'un client");
    });

    it("should show the path itself for a page it does not know", () => {
        expect(pageLabel("/nouvelle-page")).toBe("/nouvelle-page");
    });
});

describe("access attempts", () => {
    it("should say in plain words what an account tried to open", () => {
        expect(accessAttempt("GET", "/low-stock-alerts")).toBe(
            "a essayé d'ouvrir : Alertes de stock",
        );
        expect(accessAttempt("POST", "/platform/modules")).toBe(
            "a essayé de modifier : Réglages de la plateforme",
        );
        expect(accessAttempt("GET", "/inconnu")).toBe("a essayé d'ouvrir : Page protégée");
    });

    it("should translate the role", () => {
        expect(roleLabel("manager")).toBe("Employé");
    });
});
