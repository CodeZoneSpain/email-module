import { EmailError } from './email.error';

export class EmailPermanentRejectionError extends EmailError {
    readonly code = 'EMAIL_PERMANENT_REJECTION';
    readonly retryable = false;
}
