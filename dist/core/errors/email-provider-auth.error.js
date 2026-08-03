"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailProviderAuthError = void 0;
const email_error_1 = require("./email.error");
class EmailProviderAuthError extends email_error_1.EmailError {
    constructor() {
        super(...arguments);
        this.code = 'EMAIL_PROVIDER_AUTH_ERROR';
        this.retryable = false;
    }
}
exports.EmailProviderAuthError = EmailProviderAuthError;
