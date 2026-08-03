import { EmailError } from './email.error';

export class EmailRateLimitedError extends EmailError {
    readonly code = 'EMAIL_RATE_LIMITED';
    readonly retryable = true;

    constructor(
        message: string,
        readonly retryAfterSeconds?: number,
    ) {
        super(message);
    }
}
