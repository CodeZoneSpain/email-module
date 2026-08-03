"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllRecipients = getAllRecipients;
exports.toRecipientList = toRecipientList;
exports.validateEmailMessage = validateEmailMessage;
exports.isValidEmailFormat = isValidEmailFormat;
const errors_1 = require("./errors");
function isEmptyAddress(address) {
    return !address.email || address.email.trim().length === 0;
}
/**
 * Todos los destinatarios del sobre: `to` + `cc` + `bcc`. Es la lista que
 * cuenta tanto para validar direcciones vacías como para calcular
 * accepted/rejected — un bcc con dirección inválida es un rechazo real,
 * no algo que se pueda ignorar en silencio.
 */
function getAllRecipients(message) {
    return [
        ...toRecipientList(message.to),
        ...(message.cc ?? []),
        ...(message.bcc ?? []),
    ];
}
function toRecipientList(to) {
    return Array.isArray(to) ? to : [to];
}
/**
 * Validación universal, la misma para cualquier proveedor: forma del
 * mensaje, no reglas específicas de un proveedor (peso máximo de
 * adjuntos, cantidad de destinatarios permitida, formato exacto de
 * dirección, etc — eso es responsabilidad de cada adapter). Cada adapter
 * debe llamar a esto al comienzo de `send()`; el contrato de tests lo
 * verifica.
 */
function validateEmailMessage(message) {
    const primaryRecipients = toRecipientList(message.to);
    if (primaryRecipients.length === 0) {
        throw new errors_1.EmailValidationError('EmailMessage.to no puede estar vacío');
    }
    for (const recipient of getAllRecipients(message)) {
        if (isEmptyAddress(recipient)) {
            throw new errors_1.EmailValidationError('EmailMessage tiene una dirección vacía en to, cc o bcc');
        }
    }
    if (message.from && isEmptyAddress(message.from)) {
        throw new errors_1.EmailValidationError('EmailMessage.from está vacío');
    }
    if (message.replyTo && isEmptyAddress(message.replyTo)) {
        throw new errors_1.EmailValidationError('EmailMessage.replyTo está vacío');
    }
    if (!message.subject || message.subject.trim().length === 0) {
        throw new errors_1.EmailValidationError('EmailMessage.subject no puede estar vacío');
    }
    if (message.content.kind === 'html' &&
        (!message.content.html || message.content.html.trim().length === 0)) {
        throw new errors_1.EmailValidationError('EmailMessage.content.html está vacío');
    }
    if (message.content.kind === 'text' &&
        (!message.content.text || message.content.text.trim().length === 0)) {
        throw new errors_1.EmailValidationError('EmailMessage.content.text está vacío');
    }
    for (const attachment of message.attachments ?? []) {
        if (!attachment.filename || attachment.filename.trim().length === 0) {
            throw new errors_1.EmailValidationError('EmailMessage tiene un adjunto sin filename');
        }
    }
}
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmailFormat(email) {
    return EMAIL_FORMAT.test(email);
}
