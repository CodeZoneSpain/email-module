"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailConfigurationError = void 0;
const email_error_1 = require("./email.error");
class EmailConfigurationError extends email_error_1.EmailError {
    constructor() {
        super(...arguments);
        this.code = 'EMAIL_CONFIGURATION_ERROR';
        this.retryable = false;
    }
}
exports.EmailConfigurationError = EmailConfigurationError;
