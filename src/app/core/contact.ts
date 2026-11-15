// coordonnées de contact affichées dans toute l'application, à un seul endroit
// (elles pourraient plus tard venir d'un réglage)
export const CONTACT = {
    email: "aminouyabre01@gmail.com",
    // format d'affichage
    whatsappDisplay: "+226 64 72 54 64",
    // chiffres seuls, sans + ni espaces, pour wa.me
    whatsappDigits: "22664725464",
    whatsappMessage: "Bonjour, j'ai une question sur Boutiki",
};

export const mailtoLink = () => `mailto:${CONTACT.email}`;

export const whatsappLink = () =>
    `https://wa.me/${CONTACT.whatsappDigits}?text=${encodeURIComponent(CONTACT.whatsappMessage)}`;
