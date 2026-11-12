import { UserRole } from "./auth.service";

// Libellé affiché pour un rôle (vide si le rôle est inconnu ou absent)
export const getRoleLabel = (role: UserRole | null | undefined) => {
    if (role === "admin") return "Propriétaire";
    if (role === "manager") return "Gérant";
    return "";
};
