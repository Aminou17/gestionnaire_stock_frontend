import { Injectable, signal } from "@angular/core";

// Ouverture du menu sur mobile/tablette (la sidebar devient un tiroir sous 1024px)
@Injectable({ providedIn: "root" })
export class LayoutService {
    sidebarOpen = signal(false);
}
