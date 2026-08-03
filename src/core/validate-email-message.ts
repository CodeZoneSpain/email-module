import { EmailAddress, EmailMessage } from './email-message';
import { EmailValidationError } from './errors';

function isEmptyAddress(address: EmailAddress): boolean {
    return !address.email || address.email.trim().length === 0;
}

/**
 * Todos los destinatarios del sobre: `to` + `cc` + `bcc`. Es la lista que
 * cuenta tanto para validar direcciones vacías como para calcular
 * accepted/rejected — un bcc con dirección inválida es un rechazo real,
 * no algo que se pueda ignorar en silencio.
 */
export function getAllRecipients(message: EmailMessage): EmailAddress[] {
    return [
        ...toRecipientList(message.to),
        ...(message.cc ?? []),
        ...(message.bcc ?? []),
    ];
}

export function toRecipientList(to: EmailMessage['to']): EmailAddress[] {
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
export function validateEmailMessage(message: EmailMessage): void {
    const primaryRecipients = toRecipientList(message.to);
    if (primaryRecipients.length === 0) {
        throw new EmailValidationError('EmailMessage.to no puede estar vacío');
    }

    for (const recipient of getAllRecipients(message)) {
        if (isEmptyAddress(recipient)) {
            throw new EmailValidationError(
                'EmailMessage tiene una dirección vacía en to, cc o bcc',
            );
        }
    }

    if (message.from && isEmptyAddress(message.from)) {
        throw new EmailValidationError('EmailMessage.from está vacío');
    }
    if (message.replyTo && isEmptyAddress(message.replyTo)) {
        throw new EmailValidationError('EmailMessage.replyTo está vacío');
    }

    if (!message.subject || message.subject.trim().length === 0) {
        throw new EmailValidationError(
            'EmailMessage.subject no puede estar vacío',
        );
    }

    if (
        message.content.kind === 'html' &&
        (!message.content.html || message.content.html.trim().length === 0)
    ) {
        throw new EmailValidationError('EmailMessage.content.html está vacío');
    }
    if (
        message.content.kind === 'text' &&
        (!message.content.text || message.content.text.trim().length === 0)
    ) {
        throw new EmailValidationError('EmailMessage.content.text está vacío');
    }

    for (const attachment of message.attachments ?? []) {
        if (!attachment.filename || attachment.filename.trim().length === 0) {
            throw new EmailValidationError(
                'EmailMessage tiene un adjunto sin filename',
            );
        }
    }
}

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(email: string): boolean {
    return EMAIL_FORMAT.test(email);
}
