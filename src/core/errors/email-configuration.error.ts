import { EmailError } from './email.error';

export class EmailConfigurationError extends EmailError {
    readonly code = 'EMAIL_CONFIGURATION_ERROR';
    readonly retryable = false;
}
