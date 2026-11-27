import { receiptStatus } from "./receipt-status";

const none = { received_at: null, read_at: null, replied_at: null, thread_id: null };
const date = "2026-11-27T10:00:00Z";

describe("receiptStatus", () => {
    it("should show the most advanced step reached by the shop", () => {
        expect(receiptStatus(none).label).toBe("Pas encore reçu");
        expect(receiptStatus({ ...none, received_at: date }).label).toBe("Reçu, pas lu");
        expect(receiptStatus({ ...none, received_at: date, read_at: date }).label).toBe(
            "Lu, sans réponse",
        );
        expect(receiptStatus({ ...none, read_at: date, replied_at: date }).label).toBe("A répondu");
    });

    it("should show a scheduled message as such", () => {
        expect(receiptStatus(none, true).label).toBe("Programmé");
    });
});
