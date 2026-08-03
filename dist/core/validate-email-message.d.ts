import { EmailAddress, EmailMessage } from './email-message';
/**
 * Todos los destinatarios del sobre: `to` + `cc` + `bcc`. Es la lista que
 * cuenta tanto para validar direcciones vacías como para calcular
 * accepted/rejected — un bcc con dirección inválida es un rechazo real,
 * no algo que se pueda ignorar en silencio.
 */
export declare function getAllRecipients(message: EmailMessage): EmailAddress[];
export declare function toRecipientList(to: EmailMessage['to']): EmailAddress[];
/**
 * Validación universal, la misma para cualquier proveedor: forma del
 * mensaje, no reglas específicas de un proveedor (peso máximo de
 * adjuntos, cantidad de destinatarios permitida, formato exacto de
 * dirección, etc — eso es responsabilidad de cada adapter). Cada adapter
 * debe llamar a esto al comienzo de `send()`; el contrato de tests lo
 * verifica.
 */
export declare function validateEmailMessage(message: EmailMessage): void;
export declare function isValidEmailFormat(email: string): boolean;
