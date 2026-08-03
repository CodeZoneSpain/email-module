import { EmailError } from './email.error';
export declare class EmailProviderAuthError extends EmailError {
    readonly code = "EMAIL_PROVIDER_AUTH_ERROR";
    readonly retryable = false;
}
