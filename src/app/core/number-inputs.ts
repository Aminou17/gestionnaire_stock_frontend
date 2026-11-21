// Les champs "nombre" de l'appli n'attendent que des entiers positifs (quantités, montants en FCFA).
// Le navigateur accepte pourtant "e", "-" ou "," et change la valeur à la molette : on corrige une fois pour toute la page.

const BLOCKED_KEYS = new Set(["e", "E", "+", "-", ".", ","]);

const isNumberInput = (target: EventTarget | null): target is HTMLInputElement =>
    target instanceof HTMLInputElement && target.type === "number";

export function guardNumberInputs(doc: Document): void {
    doc.addEventListener("keydown", (event) => {
        if (isNumberInput(event.target) && BLOCKED_KEYS.has(event.key)) {
            event.preventDefault();
        }
    });

    // la molette sur un champ actif ferait varier le chiffre : on le quitte, la page défile normalement
    doc.addEventListener(
        "wheel",
        (event) => {
            if (isNumberInput(event.target) && event.target === doc.activeElement) {
                event.target.blur();
            }
        },
        { passive: true },
    );

    // sur téléphone : clavier à chiffres seuls, sans la virgule ni le signe moins
    doc.addEventListener("focusin", (event) => {
        if (isNumberInput(event.target) && !event.target.hasAttribute("inputmode")) {
            event.target.setAttribute("inputmode", "numeric");
        }
    });
}
