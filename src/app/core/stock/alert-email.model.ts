// L'e-mail part du compte d'envoi de l'application : la boutique ne règle aucun compte
export interface AlertEmailSettings {
    enabled: boolean;
    recipient: string | null;
    sendHour: number;
    onlyIfAlerts: boolean;
    lastSentOn: string | null;
    lastError: string | null;
}

export interface AlertEmailInput {
    enabled: boolean;
    recipient: string;
    sendHour: number;
    onlyIfAlerts: boolean;
}
