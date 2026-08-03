import { EmailError } from './email.error';
export declare class EmailRateLimitedError extends EmailError {
    readonly retryAfterSeconds?: number | undefined;
    readonly code = "EMAIL_RATE_LIMITED";
    readonly retryable = true;
    constructor(message: string, retryAfterSeconds?: number | undefined);
}
