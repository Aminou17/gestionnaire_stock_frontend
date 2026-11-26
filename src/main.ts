import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { App } from "./app/app";
import { listenInstallPrompt } from "./app/core/pwa/install.service";

// Avant tout le reste : Chrome ne prévient qu'une fois que l'application peut être installée
listenInstallPrompt();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
