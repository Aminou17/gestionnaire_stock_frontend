// Fait télécharger un fichier reçu du serveur (export PDF ou CSV)
export const downloadFile = (file: Blob, name: string) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
};
