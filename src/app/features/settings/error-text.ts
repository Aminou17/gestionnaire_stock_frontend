import { HttpErrorResponse } from "@angular/common/http";

// Message du backend s'il y en a un, sinon un message générique
export const errorText = (err: unknown, fallback: string) =>
    err instanceof HttpErrorResponse && err.error?.message ? err.error.message : fallback;
