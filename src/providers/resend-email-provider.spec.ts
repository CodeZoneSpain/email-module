import { ResendEmailProvider } from './resend-email-provider';
import { runEmailProviderContractTests } from '../core/testing/email-provider-contract';
import {
    EmailConfigurationError,
    EmailPermanentRejectionError,
    EmailProviderAuthError,
    EmailTemporaryError,
} from '../core/errors';
import { EmailMessage } from '../core/email-message';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
        json: async () => body,
    } as Response;
}

function makeSuccessFetch() {
    return jest.fn().mockResolvedValue(jsonResponse(200, { id: 'mock-message-id' }));
}

const baseOptions = {
    apiKey: 'test-key',
    defaultFrom: { email: 'noreply@example.com' },
};

const baseMessage: EmailMessage = {
    to: { email: 'user@example.com' },
    subject: 'Hola',
    content: { kind: 'text', text: 'Cuerpo' },
};

runEmailProviderContractTests(
    'ResendEmailProvider',
    () => new ResendEmailProvider(baseOptions, makeSuccessFetch() as unknown as typeof fetch),
);

describe('ResendEmailProvider', () => {
    it('llama a la API de Resend con el payload esperado', async () => {
        const fetchMock = makeSuccessFetch();
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await provider.send(baseMessage);

        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.resend.com/emails',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-key',
                }),
            }),
        );
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body).toEqual(
            expect.objectContaining({
                from: 'noreply@example.com',
                to: ['user@example.com'],
                subject: 'Hola',
                text: 'Cuerpo',
            }),
        );
    });

    it('usa message.from por encima de defaultFrom si viene', async () => {
        const fetchMock = makeSuccessFetch();
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await provider.send({
            ...baseMessage,
            from: { email: 'otro@example.com', name: 'Otro' },
        });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.from).toBe('Otro <otro@example.com>');
    });

    it('lanza EmailConfigurationError si no hay from en ningún lado', async () => {
        const provider = new ResendEmailProvider(
            { apiKey: 'test-key' },
            makeSuccessFetch() as unknown as typeof fetch,
        );

        await expect(provider.send(baseMessage)).rejects.toBeInstanceOf(
            EmailConfigurationError,
        );
    });

    it('filtra direcciones inválidas antes de llamar a la API — no llama a fetch si todas son inválidas', async () => {
        const fetchMock = makeSuccessFetch();
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await expect(
            provider.send({ ...baseMessage, to: { email: 'no-es-un-email' } }),
        ).rejects.toBeInstanceOf(EmailPermanentRejectionError);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('mapea 401/403 a EmailProviderAuthError', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValue(jsonResponse(401, { message: 'invalid api key' }));
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await expect(provider.send(baseMessage)).rejects.toBeInstanceOf(
            EmailProviderAuthError,
        );
    });

    it('mapea 429 a EmailRateLimitedError con retryAfterSeconds del header', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValue(
                jsonResponse(429, { message: 'rate limited' }, { 'retry-after': '30' }),
            );
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await expect(provider.send(baseMessage)).rejects.toMatchObject({
            retryAfterSeconds: 30,
        });
    });

    it('mapea 5xx a EmailTemporaryError', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValue(jsonResponse(500, { message: 'oops' }));
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await expect(provider.send(baseMessage)).rejects.toBeInstanceOf(
            EmailTemporaryError,
        );
    });

    it('mapea otros 4xx a EmailPermanentRejectionError', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValue(jsonResponse(422, { message: 'domain not verified' }));
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await expect(provider.send(baseMessage)).rejects.toBeInstanceOf(
            EmailPermanentRejectionError,
        );
    });

    it('mapea un fallo de red a EmailTemporaryError, sin filtrar el error crudo', async () => {
        const fetchMock = jest
            .fn()
            .mockRejectedValue(new Error('ECONNRESET secret-internal-detail'));
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        const result = provider.send(baseMessage);
        await expect(result).rejects.toBeInstanceOf(EmailTemporaryError);
        await expect(result).rejects.not.toMatchObject({
            message: expect.stringContaining('secret-internal-detail'),
        });
    });

    it('devuelve el messageId de la respuesta de Resend', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValue(jsonResponse(200, { id: 'resend-abc-123' }));
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        const result = await provider.send(baseMessage);
        expect(result.messageId).toBe('resend-abc-123');
        expect(result.provider).toBe('resend');
    });
});
