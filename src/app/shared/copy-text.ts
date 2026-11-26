// Copie un texte. Le presse-papiers moderne n'existe qu'en https ou sur localhost :
// sur une adresse du réseau local (téléphone), on passe par un champ caché.
export async function copyText(text: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // On retente avec le champ caché
        }
    }

    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    // Dans une fenêtre modale, seul ce qui est dans la fenêtre reçoit la sélection
    (document.querySelector("dialog[open]") ?? document.body).appendChild(field);

    try {
        field.select();
        field.setSelectionRange(0, text.length);
        return document.execCommand("copy");
    } catch {
        return false;
    } finally {
        field.remove();
    }
}
