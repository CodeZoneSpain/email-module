"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailValidationError = void 0;
const email_error_1 = require("./email.error");
class EmailValidationError extends email_error_1.EmailError {
    constructor() {
        super(...arguments);
        this.code = 'EMAIL_VALIDATION_ERROR';
        this.retryable = false;
    }
}
exports.EmailValidationError = EmailValidationError;
