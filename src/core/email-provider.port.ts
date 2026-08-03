import { EmailMessage } from './email-message';
import { EmailSendResult } from './email-result';

/**
 * Puerto que cualquier proveedor de correo debe implementar.
 *
 * Reglas de comportamiento (verificadas por
 * `core/testing/email-provider-contract.ts`):
 * - `send` es un único intento: no reintenta internamente. Ante un error,
 *   el llamador decide la estrategia de reintento según `EmailError.retryable`.
 * - Debe llamar a `validateEmailMessage()` al comienzo.
 * - Al menos un destinatario aceptado → devuelve `EmailSendResult` normal
 *   (puede traer algunos en `rejected`).
 * - Todos los destinatarios rechazados → lanza `EmailPermanentRejectionError`.
 * - Fallo temporal del proveedor (red, 5xx) → `EmailTemporaryError`.
 * - Límite de frecuencia del proveedor → `EmailRateLimitedError`.
 * - Nunca debe reenviar el mensaje de error crudo de un SDK externo como
 *   `message` de un `EmailError` — puede contener credenciales o detalles
 *   internos del proveedor. Construir un mensaje propio y saneado.
 */
export interface EmailProviderPort {
    send(message: EmailMessage): Promise<EmailSendResult>;
}
