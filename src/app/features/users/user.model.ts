import { User, UserRole } from "../../core/auth/auth.service";

// compte vu par l'administrateur dans la gestion des utilisateurs
export interface UserAccount extends User {
    first_name: string;
    last_name: string;
    is_active: boolean;
    created_at: string;
    last_login_at: string | null;
    // renseignés seulement pour un compte supprimé
    deleted_at?: string | null;
    deleted_by_name?: string | null;
}

export interface UserInput {
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    // seulement à la création
    password?: string;
}

export type UserStatus = "active" | "deleted" | "all";

export interface UserResponse {
    message: string;
    user: UserAccount;
}

// une ligne du journal d'audit
export interface UserActivity {
    id: number;
    action: string;
    entity_type: string | null;
    entity_id: number | null;
    result: "SUCCESS" | "FAILURE";
    created_at: string;
}
