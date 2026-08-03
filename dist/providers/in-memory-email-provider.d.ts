import { EmailProviderPort } from '../core/email-provider.port';
import { EmailMessage } from '../core/email-message';
import { EmailSendResult } from '../core/email-result';
export interface SentEmail {
    message: EmailMessage;
    result: EmailSendResult;
    sentAt: Date;
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
export declare class InMemoryEmailProvider implements EmailProviderPort {
    private readonly _sentEmails;
    get sentEmails(): readonly SentEmail[];
    send(message: EmailMessage): Promise<EmailSendResult>;
    clear(): void;
}
