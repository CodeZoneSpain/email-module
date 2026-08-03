"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailPermanentRejectionError = void 0;
const email_error_1 = require("./email.error");
class EmailPermanentRejectionError extends email_error_1.EmailError {
    constructor() {
        super(...arguments);
        this.code = 'EMAIL_PERMANENT_REJECTION';
        this.retryable = false;
    }
}
exports.EmailPermanentRejectionError = EmailPermanentRejectionError;
