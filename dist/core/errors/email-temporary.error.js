"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailTemporaryError = void 0;
const email_error_1 = require("./email.error");
class EmailTemporaryError extends email_error_1.EmailError {
    constructor() {
        super(...arguments);
        this.code = 'EMAIL_TEMPORARY_ERROR';
        this.retryable = true;
    }
}
exports.EmailTemporaryError = EmailTemporaryError;
