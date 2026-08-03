import { EmailProviderPort } from '../core/email-provider.port';
import { EmailAddress, EmailMessage } from '../core/email-message';
import { EmailSendResult } from '../core/email-result';
export interface ResendEmailProviderOptions {
    apiKey: string;
    /** Usado si el EmailMessage no trae `from` propio. */
    defaultFrom?: EmailAddress;
}
/**
 * Adapter real contra la API HTTP de Resend
 * (https://resend.com/docs/api-reference/emails/send-email). Sin SDK — usa
 * `fetch` nativo (Node 20+) para no sumarle una dependencia más al paquete
 * por un solo proveedor.
 *
 * Resend (como la mayoría de proveedores reales) no da éxito parcial por
 * request — un solo POST o se acepta entero o se rechaza entero. Por eso
 * las direcciones con formato inválido se filtran ANTES de llamar a la
 * API (mismo criterio que `InMemoryEmailProvider`), en vez de mandarlas y
 * dejar que Resend tire abajo el request completo por una sola dirección
 * mala. `accepted` acá significa "aceptado para envío por Resend en el
 * momento del submit" — no es confirmación de entrega final (eso llega,
 * si acaso, vía webhooks de Resend, fuera del alcance de `send()`).
 */
export declare class ResendEmailProvider implements EmailProviderPort {
    private readonly options;
    private readonly fetchImpl;
    constructor(options: ResendEmailProviderOptions, fetchImpl?: typeof fetch);
    send(message: EmailMessage): Promise<EmailSendResult>;
}
