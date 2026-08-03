"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailError = void 0;
class EmailError extends Error {
    constructor(message) {
        super(message);
        this.name = new.target.name;
    }
}
exports.EmailError = EmailError;
