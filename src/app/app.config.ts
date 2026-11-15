import {
    ApplicationConfig,
    LOCALE_ID,
    provideBrowserGlobalErrorListeners,
    isDevMode,
} from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { TitleStrategy, provideRouter } from "@angular/router";
import localeFr from "@angular/common/locales/fr";

import { routes } from "./app.routes";
import { authInterceptor } from "./core/auth/auth.interceptor";
import { ShopTitleStrategy } from "./core/shop/shop-title-strategy";
import { provideServiceWorker } from "@angular/service-worker";

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        { provide: LOCALE_ID, useValue: "fr" },
        { provide: TitleStrategy, useClass: ShopTitleStrategy },
        provideServiceWorker("ngsw-worker.js", {
            enabled: !isDevMode(),
            registrationStrategy: "registerWhenStable:30000",
        }),
    ],
};
