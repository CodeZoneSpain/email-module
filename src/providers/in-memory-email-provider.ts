import { randomUUID } from 'crypto';
import { EmailProviderPort } from '../core/email-provider.port';
import { EmailAddress, EmailAttachment, EmailMessage, EmailMetadata } from '../core/email-message';
import { EmailSendResult } from '../core/email-result';
import { EmailPermanentRejectionError } from '../core/errors';
import {
    getAllRecipients,
    isValidEmailFormat,
    validateEmailMessage,
} from '../core/validate-email-message';

export interface SentEmail {
    message: EmailMessage;
    result: EmailSendResult;
    sentAt: Date;
}

function cloneAddress(address: EmailAddress): EmailAddress {
    return { ...address };
}

function cloneAttachment(attachment: EmailAttachment): EmailAttachment {
    return { ...attachment, content: Buffer.from(attachment.content) };
}

function cloneMetadata(metadata: EmailMetadata): EmailMetadata {
    // metadata es un bag arbitrario que ya está documentado como
    // potencialmente persistible (ej. jsonb en un log de Postgres),
    // así que asumir que es JSON-serializable es consistente con su
    // propio contrato, no una restricción nueva.
    return JSON.parse(JSON.stringify(metadata)) as EmailMetadata;
}

function cloneMessage(message: EmailMessage): EmailMessage {
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
export class InMemoryEmailProvider implements EmailProviderPort {
    private readonly _sentEmails: SentEmail[] = [];

    get sentEmails(): readonly SentEmail[] {
        return this._sentEmails;
    }

    async send(message: EmailMessage): Promise<EmailSendResult> {
        validateEmailMessage(message);

        const recipients = getAllRecipients(message);
        const accepted = recipients
            .filter((r) => isValidEmailFormat(r.email))
            .map((r) => r.email);
        const rejected = recipients
            .filter((r) => !isValidEmailFormat(r.email))
            .map((r) => r.email);

        if (accepted.length === 0) {
            throw new EmailPermanentRejectionError(
                'Todos los destinatarios fueron rechazados (formato inválido)',
            );
        }

        const result: EmailSendResult = {
            messageId: randomUUID(),
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

    clear(): void {
        this._sentEmails.length = 0;
    }
}
