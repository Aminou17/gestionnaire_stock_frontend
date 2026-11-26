// Un bloc est un paragraphe (texte) ou une liste à puces (tableau)
export type LegalBlock = string | string[];

export interface LegalSection {
    id: string;
    title: string;
    body: LegalBlock[];
}
