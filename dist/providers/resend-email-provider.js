"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResendEmailProvider = void 0;
const errors_1 = require("../core/errors");
const validate_email_message_1 = require("../core/validate-email-message");
const RESEND_API_URL = 'https://api.resend.com/emails';
function formatAddress(address) {
    return address.name ? `${address.name} <${address.email}>` : address.email;
}
function buildResendPayload(message, from, validTo, validCc, validBcc) {
    const payload = {
        from: formatAddress(from),
        to: validTo.map(formatAddress),
        subject: message.subject,
    };
    if (message.content.kind === 'html') {
        payload.html = message.content.html;
        if (message.content.text)
            payload.text = message.content.text;
    }
    else {
        payload.text = message.content.text;
    }
    if (validCc.length)
        payload.cc = validCc.map(formatAddress);
    if (validBcc.length)
        payload.bcc = validBcc.map(formatAddress);
    if (message.replyTo)
        payload.reply_to = formatAddress(message.replyTo);
    if (message.headers)
        payload.headers = message.headers;
    if (message.attachments?.length) {
        payload.attachments = message.attachments.map((a) => ({
            filename: a.filename,
            content: a.content.toString('base64'),
        }));
    }
    return payload;
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
class ResendEmailProvider {
    constructor(options, fetchImpl = fetch) {
        this.options = options;
        this.fetchImpl = fetchImpl;
    }
    async send(message) {
        (0, validate_email_message_1.validateEmailMessage)(message);
        const from = message.from ?? this.options.defaultFrom;
        if (!from) {
            throw new errors_1.EmailConfigurationError('ResendEmailProvider: no hay "from" — ni en el mensaje ni configurado como default');
        }
        const allRecipients = (0, validate_email_message_1.getAllRecipients)(message);
        const rejected = allRecipients
            .filter((r) => !(0, validate_email_message_1.isValidEmailFormat)(r.email))
            .map((r) => r.email);
        const validTo = toRecipientList(message.to).filter((r) => (0, validate_email_message_1.isValidEmailFormat)(r.email));
        const validCc = (message.cc ?? []).filter((r) => (0, validate_email_message_1.isValidEmailFormat)(r.email));
        const validBcc = (message.bcc ?? []).filter((r) => (0, validate_email_message_1.isValidEmailFormat)(r.email));
        const accepted = [...validTo, ...validCc, ...validBcc].map((r) => r.email);
        if (accepted.length === 0) {
            throw new errors_1.EmailPermanentRejectionError('Todos los destinatarios fueron rechazados (formato inválido)');
        }
        let response;
        try {
            response = await this.fetchImpl(RESEND_API_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.options.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(buildResendPayload(message, from, validTo, validCc, validBcc)),
            });
        }
        catch {
            // Nunca reenviar el error crudo (puede filtrar detalles de red
            // internos) — mensaje propio y saneado, como documenta el port.
            throw new errors_1.EmailTemporaryError('No se pudo contactar a Resend (red)');
        }
        if (response.status === 401 || response.status === 403) {
            throw new errors_1.EmailProviderAuthError('Resend rechazó las credenciales');
        }
        if (response.status === 429) {
            const retryAfterHeader = response.headers.get('retry-after');
            const retryAfterSeconds = retryAfterHeader
                ? Number(retryAfterHeader)
                : undefined;
            throw new errors_1.EmailRateLimitedError('Resend devolvió rate limit', retryAfterSeconds);
        }
        if (response.status >= 500) {
            throw new errors_1.EmailTemporaryError('Resend devolvió un error de servidor');
        }
        if (!response.ok) {
            // 4xx que no es auth ni rate limit: Resend rechazó el mensaje
            // en sí (dominio "from" no verificado, payload inválido,
            // etc.) — no es un problema transitorio.
            throw new errors_1.EmailPermanentRejectionError('Resend rechazó el mensaje');
        }
        const data = (await response.json());
        return {
            messageId: data.id,
            provider: 'resend',
            accepted,
            rejected,
        };
    }
}
exports.ResendEmailProvider = ResendEmailProvider;
function toRecipientList(to) {
    return Array.isArray(to) ? to : [to];
}
