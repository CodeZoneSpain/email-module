import { InMemoryEmailProvider } from './in-memory-email-provider';
import { runEmailProviderContractTests } from '../core/testing/email-provider-contract';

runEmailProviderContractTests('InMemoryEmailProvider', () => new InMemoryEmailProvider());

describe('InMemoryEmailProvider', () => {
    it('guarda el mensaje enviado en sentEmails', async () => {
        const provider = new InMemoryEmailProvider();
        await provider.send({
            to: { email: 'user@example.com' },
            subject: 'Hola',
            content: { kind: 'text', text: 'Cuerpo' },
        });

        expect(provider.sentEmails).toHaveLength(1);
        expect(provider.sentEmails[0].message.subject).toBe('Hola');
    });

    it('clear() vacía el historial', async () => {
        const provider = new InMemoryEmailProvider();
        await provider.send({
            to: { email: 'user@example.com' },
            subject: 'Hola',
            content: { kind: 'text', text: 'Cuerpo' },
        });

        provider.clear();
        expect(provider.sentEmails).toHaveLength(0);
    });

    it('mutar el mensaje o sus adjuntos después de send() no afecta el historial guardado', async () => {
        const provider = new InMemoryEmailProvider();
        const message = {
            to: { email: 'user@example.com' },
            from: { email: 'origen@example.com' },
            subject: 'Hola',
            content: { kind: 'html' as const, html: 'original' },
            attachments: [
                { filename: 'a.txt', content: Buffer.from('original') },
            ],
        };

        await provider.send(message);

        message.to.email = 'mutado@example.com';
        message.from.email = 'mutado@example.com';
        message.subject = 'mutado';
        message.content.html = 'mutado';
        message.attachments[0].content.write('mutado');

        const stored = provider.sentEmails[0].message;
        expect(stored.to).toEqual({ email: 'user@example.com' });
        expect(stored.from).toEqual({ email: 'origen@example.com' });
        expect(stored.subject).toBe('Hola');
        expect((stored.content as { html: string }).html).toBe('original');
        expect(stored.attachments![0].content.toString()).toBe('original');
    });
});
