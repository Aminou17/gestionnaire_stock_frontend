const SIZE = 160;

// Une photo de plusieurs mégaoctets serait décodée en entier pour rien
const MAX_FILE_SIZE = 8 * 1024 * 1024;

// Le backend refuse au-delà de 60 000 caractères
const MAX_LENGTH = 55000;

// Recadre au centre en carré, réduit à size px (160 par défaut) et renvoie une data URL JPEG
export const resizeAvatar = (file: File, size = SIZE, maxLength = MAX_LENGTH, quality = 0.85) =>
    new Promise<string>((resolve, reject) => {
        if (!["image/png", "image/jpeg"].includes(file.type)) {
            reject(new Error("Choisissez une image PNG ou JPEG."));
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            reject(new Error("Cette image est trop lourde, choisissez-en une plus petite."));
            return;
        }

        const url = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);

            const side = Math.min(image.width, image.height);
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;

            const context = canvas.getContext("2d")!;
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, size, size);
            context.drawImage(
                image,
                (image.width - side) / 2,
                (image.height - side) / 2,
                side,
                side,
                0,
                0,
                size,
                size,
            );

            const avatar = canvas.toDataURL("image/jpeg", quality);

            if (avatar.length > maxLength) {
                reject(new Error("Cette image est trop lourde, choisissez-en une plus simple."));
                return;
            }

            resolve(avatar);
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Impossible de lire cette image."));
        };

        image.src = url;
    });

// Miniature de produit : 160 px couvre les vignettes de 88 à 112 px, même sur écran dense
const THUMB_SIZE = 160;

// Le backend refuse les miniatures de plus de 30 000 caractères
const THUMB_MAX_LENGTH = 30000;

// Qualité 0,8 d'abord, puis 0,65 si une photo très détaillée dépasse la limite
export const resizeThumb = async (file: File) => {
    try {
        return await resizeAvatar(file, THUMB_SIZE, THUMB_MAX_LENGTH, 0.8);
    } catch {
        return resizeAvatar(file, THUMB_SIZE, THUMB_MAX_LENGTH, 0.65);
    }
};
