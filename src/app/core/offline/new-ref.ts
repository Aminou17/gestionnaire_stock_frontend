// Identifiant unique créé par l'appareil : le serveur s'en sert pour ne jamais créer deux fois la même vente ou le même inventaire
export const newRef = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
              (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16),
          );
