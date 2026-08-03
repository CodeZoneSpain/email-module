export interface EmailAddress {
    email: string;
    name?: string;
}
/**
 * No incluye `kind: 'template'` a propósito: la semántica de una plantilla
 * remota vs. local vs. nombre lógico es ambigua sin un proveedor real
 * delante. Hasta v0.1.0, quien consuma esto renderiza su propio HTML/text
 * (con sus propias reglas de negocio, idioma, marca) y lo manda como
 * `html`/`text`. Se puede reintroducir cuando haya un caso concreto que
 * lo justifique, no antes.
 */
export type EmailContent = {
    kind: 'html';
    html: string;
    text?: string;
} | {
    kind: 'text';
    text: string;
};
export interface EmailAttachment {
    filename: string;
    content: Buffer;
    contentType?: string;
}
export interface EmailMetadata {
    category?: string;
    /**
     * Marca el mensaje como sensible (ej. contiene un token de reset).
     * Los adapters de inspección/log (ej. el futuro postgres-log) deben
     * redactar el contenido cuando esto es `true` — no intentan detectar
     * secretos parseando el HTML, la app que arma el mensaje es quien
     * conoce su contenido.
     */
    sensitive?: boolean;
    /**
     * `metadata` viaja tal cual a los adapters y puede quedar persistido
     * (ej. en un log de desarrollo). No poner credenciales ni secretos acá.
     */
    [key: string]: unknown;
}
export interface EmailMessage {
    to: EmailAddress | EmailAddress[];
    from?: EmailAddress;
    replyTo?: EmailAddress;
    cc?: EmailAddress[];
    bcc?: EmailAddress[];
    subject: string;
    content: EmailContent;
    attachments?: EmailAttachment[];
    headers?: Record<string, string>;
    tags?: string[];
    /**
     * Mejor esfuerzo: el core no la garantiza. Un adapter cuyo proveedor
     * soporte deduplicación nativa (ej. Resend, Postmark) puede usarla;
     * si el proveedor no la soporta, el adapter puede ignorarla en
     * silencio y reenviar duplicado — no es una garantía a nivel de red.
     */
    idempotencyKey?: string;
    metadata?: EmailMetadata;
}
