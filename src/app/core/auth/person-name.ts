// Ancien format : un seul nom complet. On coupe au dernier espace, un nom sans espace va dans le prénom.
export const splitName = (fullName: string) => {
    const name = fullName.trim().replace(/\s+/g, " ");
    const cut = name.lastIndexOf(" ");

    if (cut === -1) return { firstName: name, lastName: "" };

    return { firstName: name.slice(0, cut), lastName: name.slice(cut + 1) };
};

export const joinName = (firstName: string, lastName: string) =>
    [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
