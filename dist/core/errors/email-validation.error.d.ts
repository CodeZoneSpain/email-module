import { EmailError } from './email.error';
export declare class EmailValidationError extends EmailError {
    readonly code = "EMAIL_VALIDATION_ERROR";
    readonly retryable = false;
}
