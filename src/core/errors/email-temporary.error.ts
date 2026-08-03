import { EmailError } from './email.error';

export class EmailTemporaryError extends EmailError {
    readonly code = 'EMAIL_TEMPORARY_ERROR';
    readonly retryable = true;
}
