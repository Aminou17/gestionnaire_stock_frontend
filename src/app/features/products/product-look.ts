// petits mots ignorés : « Savon de Marseille » donne SM et non SD
const SMALL_WORDS = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "et", "à", "au", "aux", "en"]);

// pastille du produit : deux initiales et une couleur qui dépend de la catégorie
export const productInitials = (name: string) => {
    const words = name
        .split(/[\s'’]+/)
        .filter((word) => /^\p{L}/u.test(word) && !SMALL_WORDS.has(word.toLowerCase()));
    const letters =
        words.length > 1
            ? words[0][0] + words[1][0]
            : (words[0] ?? name.trim()).slice(0, 2);
    return letters.toUpperCase();
};

export const categoryTone = (category: string) => {
    let sum = 0;
    for (const char of category) sum += char.charCodeAt(0);
    return sum % 4;
};

// couleur stable d'un produit : le même nom donne toujours la même teinte (0 à 7)
export const productTone = (name: string) => {
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997;
    return hash % 8;
};

// marge en pourcentage du prix de vente, null si le prix d'achat est inconnu
export const marginPercent = (sale: number, purchase: number | undefined) =>
    purchase === undefined || sale <= 0 ? null : Math.round(((sale - purchase) / sale) * 100);
