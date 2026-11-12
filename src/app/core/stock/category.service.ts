import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../api.config";
import { Category, CategoryDetail } from "./category.model";

@Injectable({ providedIn: "root" })
export class CategoryService {
    private http = inject(HttpClient);

    getCategories() {
        return this.http.get<Category[]>(`${API_URL}/categories`);
    }

    getCategory(id: number) {
        return this.http.get<CategoryDetail>(`${API_URL}/categories/${id}`);
    }

    createCategory(name: string, description: string | null = null) {
        return this.http.post<Category>(`${API_URL}/categories`, { name, description });
    }

    updateCategory(id: number, name: string, description: string | null = null) {
        return this.http.patch<Category>(`${API_URL}/categories/${id}`, { name, description });
    }

    deleteCategory(id: number) {
        return this.http.delete<{ message: string }>(`${API_URL}/categories/${id}`);
    }

    restoreCategory(id: number) {
        return this.http.patch<Category>(`${API_URL}/categories/${id}/restore`, {});
    }
}
