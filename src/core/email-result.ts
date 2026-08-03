export interface EmailSendResult {
    messageId: string;
    provider?: string;
    accepted: string[];
    rejected: string[];
}
