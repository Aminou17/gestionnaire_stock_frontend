export interface AlertEmailSettings {
    enabled: boolean;
    recipient: string | null;
    sendHour: number;
    onlyIfAlerts: boolean;
    gmailUser: string | null;
    // le mot de passe n'est jamais renvoyé par le serveur
    hasPassword: boolean;
    lastSentOn: string | null;
    lastError: string | null;
}

export interface AlertEmailInput {
    enabled: boolean;
    recipient: string;
    sendHour: number;
    onlyIfAlerts: boolean;
    gmailUser: string;
    // vide : le serveur garde le mot de passe déjà enregistré
    gmailPassword: string;
}
