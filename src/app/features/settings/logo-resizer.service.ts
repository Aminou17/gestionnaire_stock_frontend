import { Injectable } from "@angular/core";

const MAX_WIDTH = 240;
const MAX_HEIGHT = 120;

// une photo de plusieurs mégaoctets serait décodée en entier pour rien
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// le backend refuse au-delà de 70 000 caractères, on garde une marge
const MAX_LENGTH = 60000;

@Injectable({ providedIn: "root" })
export class LogoResizerService {
    // réduit l'image choisie et la renvoie en data URL PNG, ou JPEG si le PNG reste trop lourd
    resize(file: File) {
        return new Promise<string>((resolve, reject) => {
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

                const scale = Math.min(1, MAX_WIDTH / image.width, MAX_HEIGHT / image.height);
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));

                const context = canvas.getContext("2d")!;
                context.drawImage(image, 0, 0, canvas.width, canvas.height);

                let logo = canvas.toDataURL("image/png");

                if (logo.length > MAX_LENGTH) {
                    // le JPEG n'a pas de transparence : le fond blanc est celui du papier
                    context.globalCompositeOperation = "destination-over";
                    context.fillStyle = "#ffffff";
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    logo = canvas.toDataURL("image/jpeg", 0.85);
                }

                if (logo.length > MAX_LENGTH) {
                    reject(
                        new Error("Cette image est trop lourde, choisissez-en une plus simple."),
                    );
                    return;
                }

                resolve(logo);
            };

            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Impossible de lire cette image."));
            };

            image.src = url;
        });
    }
}
