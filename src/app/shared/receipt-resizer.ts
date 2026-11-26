// Une photo de plusieurs mégaoctets serait décodée en entier pour rien
const MAX_FILE_SIZE = 12 * 1024 * 1024;

// Le serveur refuse au-delà de 150 000 caractères
const MAX_LENGTH = 140000;

// Réduit la photo d'un reçu (le plus grand côté à 1100 px) en JPEG, en baissant la qualité jusqu'à ce qu'elle tienne
export const resizeReceipt = (file: File, maxSide = 1100) =>
    new Promise<string>((resolve, reject) => {
        if (!file.type.startsWith("image/")) {
            reject(new Error("Choisissez une photo."));
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            reject(new Error("Cette photo est trop lourde, choisissez-en une plus petite."));
            return;
        }

        const url = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);

            const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(image.width * ratio);
            canvas.height = Math.round(image.height * ratio);

            const context = canvas.getContext("2d")!;
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            for (const quality of [0.75, 0.6, 0.45, 0.3]) {
                const data = canvas.toDataURL("image/jpeg", quality);
                if (data.length <= MAX_LENGTH) {
                    resolve(data);
                    return;
                }
            }

            reject(new Error("Cette photo est trop lourde, choisissez-en une plus petite."));
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Impossible de lire cette photo."));
        };

        image.src = url;
    });
