import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { map } from "rxjs";

import { API_URL } from "../../core/api.config";
import { UserAccount, UserActivity, UserInput, UserResponse, UserStatus } from "./user.model";

// Employés : réservés à l'administrateur, côté backend comme côté interface
@Injectable({ providedIn: "root" })
export class UserService {
    private http = inject(HttpClient);

    getUsers(status: UserStatus = "active") {
        return this.http.get<UserAccount[]>(`${API_URL}/users`, { params: { status } });
    }

    getUser(id: number) {
        return this.http.get<UserAccount>(`${API_URL}/users/${id}`);
    }

    createUser(input: UserInput) {
        return this.http.post<UserResponse>(`${API_URL}/users`, input);
    }

    updateUser(id: number, input: UserInput) {
        return this.http.put<UserResponse>(`${API_URL}/users/${id}`, input);
    }

    resetPassword(id: number, password: string) {
        return this.http.put<UserResponse>(`${API_URL}/users/${id}/password`, { password });
    }

    deleteUser(id: number) {
        return this.http.delete<UserResponse>(`${API_URL}/users/${id}`);
    }

    restoreUser(id: number) {
        return this.http.patch<UserResponse>(`${API_URL}/users/${id}/restore`, {});
    }

    getActivity(userId: number, limit = 5) {
        return this.http
            .get<{ data: UserActivity[] }>(`${API_URL}/audit-logs`, { params: { userId, limit } })
            .pipe(map((page) => page.data));
    }
}
