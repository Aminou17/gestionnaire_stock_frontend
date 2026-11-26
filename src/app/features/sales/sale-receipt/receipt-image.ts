import { toBlob } from "html-to-image";

import { toWhatsAppLink } from "../../../shared/phone";

// Le ticket est dessiné en grand pour rester net sur un écran de téléphone
export const receiptBlob = async (element: HTMLElement) => {
    const blob = await toBlob(element, {
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        style: { position: "static", left: "0", top: "0" },
    });
    if (!blob) throw new Error("image vide");
    return blob;
};

export type ShareResult = "shared" | "copied" | "downloaded" | "cancelled";

const download = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
};

// Client avec un numéro : image copiée et conversation WhatsApp du client ouverte, à coller (Ctrl+V ou appui long).
// sans numéro, sur téléphone : menu de partage, où l'on choisit la personne.
// à appeler directement depuis le clic : le navigateur refuse la copie et l'ouverture sinon
export const shareReceiptImage = async (
    element: HTMLElement,
    fileName: string,
    phone: string | null | undefined,
    defaultCode: string,
): Promise<ShareResult> => {
    const pending = receiptBlob(element);

    // Le menu de partage n'existe que sur téléphone et tablette, et ne sait pas viser un client
    const isTouch =
        navigator.maxTouchPoints > 0 && /android|iphone|ipad/i.test(navigator.userAgent);
    if (isTouch && navigator.share && !phone) {
        const file = new File([await pending], fileName, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({ files: [file] });
                return "shared";
            } catch (err) {
                if ((err as DOMException).name === "AbortError") return "cancelled";
                throw err;
            }
        }
    }

    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": pending })]);
            if (phone) window.open(toWhatsAppLink(phone, defaultCode), "_blank", "noopener");
            return "copied";
        } catch {
            // Copie refusée : on retombe sur le téléchargement
        }
    }

    download(await pending, fileName);
    if (phone) window.open(toWhatsAppLink(phone, defaultCode), "_blank", "noopener");
    return "downloaded";
};
