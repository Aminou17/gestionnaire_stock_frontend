// coordonnées de contact affichées dans toute l'application, à un seul endroit
// (elles pourraient plus tard venir d'un réglage)
export const CONTACT = {
    email: "aminouyabre01@gmail.com",
    // chiffres seuls, sans + ni espaces, pour wa.me ; le numéro lui-même n'est jamais affiché
    whatsappDigits: "22664725464",
    whatsappMessage:
        "Bonjour, je vous contacte depuis Boutiki. J'aurais besoin d'un renseignement, pourriez-vous m'aider ?",
};

export const mailtoLink = () => `mailto:${CONTACT.email}`;

// message : texte déjà écrit dans la conversation, par défaut un message poli et court
export const whatsappLink = (message = CONTACT.whatsappMessage) =>
    `https://wa.me/${CONTACT.whatsappDigits}?text=${encodeURIComponent(message)}`;
