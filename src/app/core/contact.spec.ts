import { CONTACT, mailtoLink } from "./contact";

describe("contact", () => {
    it("construit le lien mailto", () => {
        expect(mailtoLink()).toBe(`mailto:${CONTACT.email}`);
    });
});
