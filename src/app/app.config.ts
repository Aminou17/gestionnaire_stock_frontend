import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { provideRouter } from "@angular/router";
import localeFr from "@angular/common/locales/fr";

import { routes } from "./app.routes";
import { authInterceptor } from "./core/auth/auth.interceptor";

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        { provide: LOCALE_ID, useValue: "fr" },
    ],
};
