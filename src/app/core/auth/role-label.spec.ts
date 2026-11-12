import { getRoleLabel } from "./role-label";

describe("getRoleLabel", () => {
    it("should map each role to its label", () => {
        expect(getRoleLabel("admin")).toBe("Propriétaire");
        expect(getRoleLabel("manager")).toBe("Gérant");
    });

    // ancien backend ou donnée manquante : on n'invente pas de rôle
    it("should return an empty label when the role is missing", () => {
        expect(getRoleLabel(undefined)).toBe("");
        expect(getRoleLabel(null)).toBe("");
    });
});
