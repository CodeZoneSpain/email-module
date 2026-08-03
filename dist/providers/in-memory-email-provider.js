"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryEmailProvider = void 0;
const crypto_1 = require("crypto");
const errors_1 = require("../core/errors");
const validate_email_message_1 = require("../core/validate-email-message");
function cloneAddress(address) {
    return { ...address };
}
function cloneAttachment(attachment) {
    return { ...attachment, content: Buffer.from(attachment.content) };
}
function cloneMetadata(metadata) {
    // metadata es un bag arbitrario que ya está documentado como
    // potencialmente persistible (ej. jsonb en un log de Postgres),
    // así que asumir que es JSON-serializable es consistente con su
    // propio contrato, no una restricción nueva.
    return JSON.parse(JSON.stringify(metadata));
}
function cloneMessage(message) {
    return {
        ...message,
        to: Array.isArray(message.to)
            ? message.to.map(cloneAddress)
            : cloneAddress(message.to),
        from: message.from ? cloneAddress(message.from) : undefined,
        replyTo: message.replyTo ? cloneAddress(message.replyTo) : undefined,
        cc: message.cc?.map(cloneAddress),
        bcc: message.bcc?.map(cloneAddress),
        content: { ...message.content },
        attachments: message.attachments?.map(cloneAttachment),
        headers: message.headers ? { ...message.headers } : undefined,
        tags: message.tags ? [...message.tags] : undefined,
        metadata: message.metadata ? cloneMetadata(message.metadata) : undefined,
    };
}
/**
 * Adapter en memoria — no envía nada real. Pensado para tests
 * automatizados: se inspecciona `sentEmails` para hacer aserciones.
 * No persiste entre procesos — para inspección humana en dev/staging
 * usar el adapter de log en Postgres.
 *
 * `accepted`/`rejected` se calculan sobre to+cc+bcc (todo el sobre, no
 * solo `to`). Simula rechazo por dirección con formato inválido — no
 * existe forma de simular rate limit ni fallos temporales sin una red
 * real detrás, eso queda documentado como obligación del adapter, no
 * probado acá.
 */
class InMemoryEmailProvider {
    constructor() {
        this._sentEmails = [];
    }
    get sentEmails() {
        return this._sentEmails;
    }
    async send(message) {
        (0, validate_email_message_1.validateEmailMessage)(message);
        const recipients = (0, validate_email_message_1.getAllRecipients)(message);
        const accepted = recipients
            .filter((r) => (0, validate_email_message_1.isValidEmailFormat)(r.email))
            .map((r) => r.email);
        const rejected = recipients
            .filter((r) => !(0, validate_email_message_1.isValidEmailFormat)(r.email))
            .map((r) => r.email);
        if (accepted.length === 0) {
            throw new errors_1.EmailPermanentRejectionError('Todos los destinatarios fueron rechazados (formato inválido)');
        }
        const result = {
            messageId: (0, crypto_1.randomUUID)(),
            provider: 'in-memory',
            accepted,
            rejected,
        };
        this._sentEmails.push({
            message: cloneMessage(message),
            result: { ...result, accepted: [...accepted], rejected: [...rejected] },
            sentAt: new Date(),
        });
        return result;
    }
    clear() {
        this._sentEmails.length = 0;
    }
}
exports.InMemoryEmailProvider = InMemoryEmailProvider;
