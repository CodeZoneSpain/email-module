"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailRateLimitedError = void 0;
const email_error_1 = require("./email.error");
class EmailRateLimitedError extends email_error_1.EmailError {
    constructor(message, retryAfterSeconds) {
        super(message);
        this.retryAfterSeconds = retryAfterSeconds;
        this.code = 'EMAIL_RATE_LIMITED';
        this.retryable = true;
    }
}
exports.EmailRateLimitedError = EmailRateLimitedError;
