import { EmailProviderPort } from '../email-provider.port';
import { EmailMessage } from '../email-message';
import { EmailError, EmailPermanentRejectionError, EmailValidationError } from '../errors';

/**
 * Suite de tests de comportamiento que cualquier EmailProviderPort debe
 * cumplir. Cada adapter nuevo (InMemory, Postgres-log, Resend, SES, ...)
 * debe invocar esto en su propio .spec.ts contra su propia instancia.
 * Sin esto, "agnóstico de proveedor" es solo una promesa de tipos.
 *
 * No cubre rate limit ni fallos temporales: no hay forma genérica de
 * simular una falla de red/proveedor sin acoplar el contrato a hooks de
 * prueba artificiales. Esas reglas quedan documentadas en
 * `EmailProviderPort` y se validan en el .spec.ts propio de cada adapter
 * real (mockeando su SDK), no acá.
 */
export function runEmailProviderContractTests(
    adapterName: string,
    makeProvider: () => EmailProviderPort,
): void {
    describe(`EmailProviderPort contract — ${adapterName}`, () => {
        const baseMessage: EmailMessage = {
            to: { email: 'destinatario@example.com' },
            subject: 'Asunto de prueba',
            content: { kind: 'text', text: 'Cuerpo de prueba' },
        };

        it('envía y devuelve un EmailSendResult con messageId y el destinatario en accepted', async () => {
            const provider = makeProvider();
            const result = await provider.send(baseMessage);

            expect(result.messageId).toEqual(expect.any(String));
            expect(result.messageId.length).toBeGreaterThan(0);
            expect(result.accepted).toContain('destinatario@example.com');
            expect(result.rejected).toEqual([]);
        });

        it('acepta múltiples destinatarios', async () => {
            const provider = makeProvider();
            const result = await provider.send({
                ...baseMessage,
                to: [
                    { email: 'uno@example.com' },
                    { email: 'dos@example.com' },
                ],
            });

            expect(result.accepted).toEqual(
                expect.arrayContaining(['uno@example.com', 'dos@example.com']),
            );
        });

        it('cc y bcc cuentan en accepted/rejected igual que to', async () => {
            const provider = makeProvider();
            const result = await provider.send({
                ...baseMessage,
                cc: [{ email: 'copia@example.com' }],
                bcc: [{ email: 'no-es-un-email' }],
            });

            expect(result.accepted).toContain('copia@example.com');
            expect(result.rejected).toContain('no-es-un-email');
        });

        it('acepta contenido html', async () => {
            const provider = makeProvider();
            await expect(
                provider.send({
                    ...baseMessage,
                    content: { kind: 'html', html: '<p>hola</p>' },
                }),
            ).resolves.toBeDefined();
        });

        it('lanza EmailValidationError si no hay destinatarios', async () => {
            const provider = makeProvider();
            await expect(
                provider.send({ ...baseMessage, to: [] }),
            ).rejects.toBeInstanceOf(EmailValidationError);
        });

        it('lanza EmailValidationError si el asunto está vacío', async () => {
            const provider = makeProvider();
            await expect(
                provider.send({ ...baseMessage, subject: '' }),
            ).rejects.toBeInstanceOf(EmailValidationError);
        });

        it('lanza EmailValidationError si una dirección está vacía', async () => {
            const provider = makeProvider();
            await expect(
                provider.send({ ...baseMessage, to: { email: '' } }),
            ).rejects.toBeInstanceOf(EmailValidationError);
        });

        it('lanza EmailValidationError si una dirección de cc/bcc está vacía', async () => {
            const provider = makeProvider();
            await expect(
                provider.send({ ...baseMessage, cc: [{ email: '' }] }),
            ).rejects.toBeInstanceOf(EmailValidationError);
        });

        it('lanza EmailValidationError si from está vacío', async () => {
            const provider = makeProvider();
            await expect(
                provider.send({ ...baseMessage, from: { email: '' } }),
            ).rejects.toBeInstanceOf(EmailValidationError);
        });

        it('lanza EmailValidationError si replyTo está vacío', async () => {
            const provider = makeProvider();
            await expect(
                provider.send({ ...baseMessage, replyTo: { email: '' } }),
            ).rejects.toBeInstanceOf(EmailValidationError);
        });

        it('lanza EmailValidationError si el contenido html está vacío', async () => {
            const provider = makeProvider();
            await expect(
                provider.send({
                    ...baseMessage,
                    content: { kind: 'html', html: '' },
                }),
            ).rejects.toBeInstanceOf(EmailValidationError);
        });

        it('lanza EmailValidationError si el contenido text está vacío', async () => {
            const provider = makeProvider();
            await expect(
                provider.send({ ...baseMessage, content: { kind: 'text', text: '' } }),
            ).rejects.toBeInstanceOf(EmailValidationError);
        });

        it('lanza EmailValidationError si un adjunto no tiene filename', async () => {
            const provider = makeProvider();
            await expect(
                provider.send({
                    ...baseMessage,
                    attachments: [
                        { filename: '', content: Buffer.from('x') },
                    ],
                }),
            ).rejects.toBeInstanceOf(EmailValidationError);
        });

        it('lanza EmailPermanentRejectionError si todos los destinatarios son rechazados', async () => {
            const provider = makeProvider();
            await expect(
                provider.send({ ...baseMessage, to: { email: 'no-es-un-email' } }),
            ).rejects.toBeInstanceOf(EmailPermanentRejectionError);
        });

        it('devuelve éxito parcial cuando al menos un destinatario es válido', async () => {
            const provider = makeProvider();
            const result = await provider.send({
                ...baseMessage,
                to: [
                    { email: 'valido@example.com' },
                    { email: 'no-es-un-email' },
                ],
            });

            expect(result.accepted).toContain('valido@example.com');
            expect(result.rejected).toContain('no-es-un-email');
        });

        it('no muta el EmailMessage recibido', async () => {
            const provider = makeProvider();
            const message: EmailMessage = {
                ...baseMessage,
                to: [{ email: 'destinatario@example.com' }],
            };
            const snapshot = JSON.parse(JSON.stringify(message));

            await provider.send(message);

            expect(message).toEqual(snapshot);
        });

        it('todos los errores lanzados son instancias de EmailError', async () => {
            const provider = makeProvider();
            await expect(
                provider.send({ ...baseMessage, to: [] }),
            ).rejects.toBeInstanceOf(EmailError);
        });
    });
}
