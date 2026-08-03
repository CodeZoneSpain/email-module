import { EmailError } from './email.error';
export declare class EmailPermanentRejectionError extends EmailError {
    readonly code = "EMAIL_PERMANENT_REJECTION";
    readonly retryable = false;
}
