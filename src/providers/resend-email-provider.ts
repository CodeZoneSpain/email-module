import { EmailProviderPort } from '../core/email-provider.port';
import { EmailAddress, EmailAttachment, EmailMessage } from '../core/email-message';
import { EmailSendResult } from '../core/email-result';
import {
    EmailConfigurationError,
    EmailPermanentRejectionError,
    EmailProviderAuthError,
    EmailRateLimitedError,
    EmailTemporaryError,
    EmailValidationError,
} from '../core/errors';
import {
    getAllRecipients,
    isValidEmailFormat,
    validateEmailMessage,
} from '../core/validate-email-message';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_IDEMPOTENCY_KEY_LENGTH = 256;

export interface ResendEmailProviderOptions {
    apiKey: string;
    /** Usado si el EmailMessage no trae `from` propio. */
    defaultFrom?: EmailAddress;
    /** Default 10000ms. Mapea a EmailTemporaryError si se cumple. */
    timeoutMs?: number;
}

function formatAddress(address: EmailAddress): string {
    return address.name ? `${address.name} <${address.email}>` : address.email;
}

function buildResendPayload(
    message: EmailMessage,
    from: EmailAddress,
    validTo: EmailAddress[],
    validCc: EmailAddress[],
    validBcc: EmailAddress[],
) {
    const payload: Record<string, unknown> = {
        from: formatAddress(from),
        to: validTo.map(formatAddress),
        subject: message.subject,
    };

    if (message.content.kind === 'html') {
        payload.html = message.content.html;
        if (message.content.text) payload.text = message.content.text;
    } else {
        payload.text = message.content.text;
    }

    if (validCc.length) payload.cc = validCc.map(formatAddress);
    if (validBcc.length) payload.bcc = validBcc.map(formatAddress);
    if (message.replyTo) payload.reply_to = formatAddress(message.replyTo);
    if (message.headers) payload.headers = message.headers;
    if (message.attachments?.length) {
        payload.attachments = message.attachments.map((a: EmailAttachment) => ({
            filename: a.filename,
            content: a.content.toString('base64'),
        }));
    }

    // EmailMessage.tags es string[]; Resend espera pares {name, value}.
    // No hay una conversión no-ambigua entre ambos shapes — mandar algo
    // inventado (ej. { name: 'tag', value: t }) sería tan arbitrario como
    // no mandar nada, así que por ahora se omite. Si algún consumidor
    // necesita tags de verdad contra Resend, hay que rediseñar
    // EmailMessage.tags a pares {name, value} primero, no forzarlo acá.

    return payload;
}

function toRecipientList(to: EmailMessage['to']): EmailAddress[] {
    return Array.isArray(to) ? to : [to];
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
export class ResendEmailProvider implements EmailProviderPort {
    private readonly timeoutMs: number;

    constructor(
        private readonly options: ResendEmailProviderOptions,
        private readonly fetchImpl: typeof fetch = fetch,
    ) {
        if (!options.apiKey || options.apiKey.trim().length === 0) {
            throw new EmailConfigurationError(
                'ResendEmailProvider: apiKey vacío',
            );
        }
        if (
            options.defaultFrom &&
            !isValidEmailFormat(options.defaultFrom.email)
        ) {
            throw new EmailConfigurationError(
                'ResendEmailProvider: defaultFrom.email con formato inválido',
            );
        }
        if (
            options.timeoutMs !== undefined &&
            (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0)
        ) {
            throw new EmailConfigurationError(
                'ResendEmailProvider: timeoutMs debe ser un entero positivo',
            );
        }
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    }

    async send(message: EmailMessage): Promise<EmailSendResult> {
        validateEmailMessage(message);

        const from = message.from ?? this.options.defaultFrom;
        if (!from) {
            throw new EmailConfigurationError(
                'ResendEmailProvider: no hay "from" — ni en el mensaje ni configurado como default',
            );
        }
        // message.from es input del llamador (no config del adapter), así
        // que un formato inválido acá es EmailValidationError — mismo
        // criterio que el resto de validaciones de EmailMessage — no
        // EmailConfigurationError, que queda reservado para lo que
        // configura quien instancia el adapter (apiKey, defaultFrom).
        if (message.from && !isValidEmailFormat(message.from.email)) {
            throw new EmailValidationError('EmailMessage.from con formato inválido');
        }
        if (
            message.idempotencyKey &&
            message.idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH
        ) {
            throw new EmailValidationError(
                `EmailMessage.idempotencyKey excede el máximo de Resend (${MAX_IDEMPOTENCY_KEY_LENGTH} caracteres)`,
            );
        }

        const allRecipients = getAllRecipients(message);
        const rejected = allRecipients
            .filter((r) => !isValidEmailFormat(r.email))
            .map((r) => r.email);

        const validTo = toRecipientList(message.to).filter((r) =>
            isValidEmailFormat(r.email),
        );
        const validCc = (message.cc ?? []).filter((r) =>
            isValidEmailFormat(r.email),
        );
        const validBcc = (message.bcc ?? []).filter((r) =>
            isValidEmailFormat(r.email),
        );
        const accepted = [...validTo, ...validCc, ...validBcc].map(
            (r) => r.email,
        );

        if (accepted.length === 0) {
            throw new EmailPermanentRejectionError(
                'Todos los destinatarios fueron rechazados (formato inválido)',
            );
        }
        // Resend exige `to` no vacío — si el único destinatario válido
        // terminó en cc/bcc (ej. `to` tenía una dirección inválida),
        // igual no es enviable por esta API, aunque accepted > 0.
        if (validTo.length === 0) {
            throw new EmailPermanentRejectionError(
                'Resend requiere al menos un destinatario válido en "to"',
            );
        }

        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.options.apiKey}`,
            'Content-Type': 'application/json',
        };
        if (message.idempotencyKey) {
            headers['Idempotency-Key'] = message.idempotencyKey;
        }

        let response: Response;
        try {
            response = await this.fetchImpl(RESEND_API_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify(
                    buildResendPayload(message, from, validTo, validCc, validBcc),
                ),
                signal: AbortSignal.timeout(this.timeoutMs),
            });
        } catch {
            // Cubre fallo de red Y timeout (AbortSignal.timeout rechaza el
            // fetch) — nunca reenviar el error crudo, puede filtrar
            // detalles internos, como documenta el port.
            throw new EmailTemporaryError(
                'No se pudo contactar a Resend (red o timeout)',
            );
        }

        if (response.status === 401 || response.status === 403) {
            throw new EmailProviderAuthError('Resend rechazó las credenciales');
        }
        if (response.status === 429) {
            const retryAfterHeader = response.headers.get('retry-after');
            // Number(null) === 0 y Number.isFinite(0) === true — un header
            // AUSENTE (null) no puede tratarse igual que "0 segundos", por
            // eso se chequea explícitamente que el header exista y no esté
            // vacío antes de parsearlo, no solo que el resultado sea finito.
            const parsed = retryAfterHeader?.trim()
                ? Number(retryAfterHeader)
                : Number.NaN;
            const retryAfterSeconds =
                Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
            throw new EmailRateLimitedError(
                'Resend devolvió rate limit',
                retryAfterSeconds,
            );
        }
        if (response.status >= 500) {
            throw new EmailTemporaryError('Resend devolvió un error de servidor');
        }
        if (response.status === 409) {
            // Resend distingue dos 409 (docs: invalid_idempotent_request vs.
            // concurrent_idempotent_requests) pero su documentación no
            // especifica en qué campo del JSON viaja el código — no pude
            // confirmarlo contra su doc real. Se revisan varios nombres de
            // campo posibles; si no matchea ninguno, se trata como
            // permanente (comportamiento previo, conservador).
            let errorBody: Record<string, unknown> | null = null;
            try {
                errorBody = (await response.json()) as Record<string, unknown>;
            } catch {
                // sin body parseable — cae al rechazo permanente de abajo
            }
            const errorCode =
                errorBody?.name ?? errorBody?.type ?? errorBody?.code;
            if (errorCode === 'concurrent_idempotent_requests') {
                throw new EmailTemporaryError(
                    'Resend: otra request con la misma Idempotency-Key sigue en curso',
                );
            }
            throw new EmailPermanentRejectionError(
                'Resend rechazó el mensaje (409)',
            );
        }
        if (!response.ok) {
            // 4xx que no es auth ni rate limit: Resend rechazó el mensaje
            // en sí (dominio "from" no verificado, payload inválido,
            // etc.) — no es un problema transitorio.
            throw new EmailPermanentRejectionError('Resend rechazó el mensaje');
        }

        let data: unknown;
        try {
            data = await response.json();
        } catch {
            throw new EmailTemporaryError(
                'Resend devolvió una respuesta 2xx con JSON inválido',
            );
        }
        const messageId = (data as { id?: unknown } | null)?.id;
        if (typeof messageId !== 'string' || messageId.length === 0) {
            throw new EmailTemporaryError(
                'Resend devolvió una respuesta 2xx sin id de mensaje',
            );
        }

        return {
            messageId,
            provider: 'resend',
            accepted,
            rejected,
        };
    }
}
