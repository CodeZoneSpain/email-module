import { ResendEmailProvider } from './resend-email-provider';
import { runEmailProviderContractTests } from '../core/testing/email-provider-contract';
import {
    EmailConfigurationError,
    EmailPermanentRejectionError,
    EmailProviderAuthError,
    EmailTemporaryError,
    EmailValidationError,
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

    describe('validación de configuración (constructor)', () => {
        it('lanza EmailConfigurationError si apiKey está vacío', () => {
            expect(() => new ResendEmailProvider({ apiKey: '' })).toThrow(
                EmailConfigurationError,
            );
        });

        it('lanza EmailConfigurationError si defaultFrom.email tiene formato inválido', () => {
            expect(
                () =>
                    new ResendEmailProvider({
                        apiKey: 'test-key',
                        defaultFrom: { email: 'no-es-un-email' },
                    }),
            ).toThrow(EmailConfigurationError);
        });

        it.each([-1, 0, Infinity, 1.5, NaN])(
            'lanza EmailConfigurationError si timeoutMs es %p',
            (timeoutMs) => {
                expect(
                    () =>
                        new ResendEmailProvider({
                            apiKey: 'test-key',
                            timeoutMs,
                        }),
                ).toThrow(EmailConfigurationError);
            },
        );

        it('acepta un timeoutMs entero positivo', () => {
            expect(
                () => new ResendEmailProvider({ apiKey: 'test-key', timeoutMs: 5000 }),
            ).not.toThrow();
        });
    });

    it('lanza EmailValidationError si message.from tiene formato inválido', async () => {
        const provider = new ResendEmailProvider(
            baseOptions,
            makeSuccessFetch() as unknown as typeof fetch,
        );

        await expect(
            provider.send({ ...baseMessage, from: { email: 'no-es-un-email' } }),
        ).rejects.toBeInstanceOf(EmailValidationError);
    });

    it('lanza EmailValidationError si idempotencyKey excede 256 caracteres', async () => {
        const provider = new ResendEmailProvider(
            baseOptions,
            makeSuccessFetch() as unknown as typeof fetch,
        );

        await expect(
            provider.send({ ...baseMessage, idempotencyKey: 'x'.repeat(257) }),
        ).rejects.toBeInstanceOf(EmailValidationError);
    });

    it('manda idempotencyKey como header Idempotency-Key cuando viene', async () => {
        const fetchMock = makeSuccessFetch();
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await provider.send({ ...baseMessage, idempotencyKey: 'reset-user-1' });

        expect(fetchMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Idempotency-Key': 'reset-user-1',
                }),
            }),
        );
    });

    it('no manda header Idempotency-Key si no viene idempotencyKey', async () => {
        const fetchMock = makeSuccessFetch();
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await provider.send(baseMessage);

        const headers = fetchMock.mock.calls[0][1].headers;
        expect(headers['Idempotency-Key']).toBeUndefined();
    });

    it('rechaza sin llamar a fetch si "to" queda vacío tras filtrar, aunque cc tenga un válido', async () => {
        const fetchMock = makeSuccessFetch();
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await expect(
            provider.send({
                ...baseMessage,
                to: { email: 'no-es-un-email' },
                cc: [{ email: 'valido@example.com' }],
            }),
        ).rejects.toBeInstanceOf(EmailPermanentRejectionError);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('lanza EmailTemporaryError si la respuesta 2xx trae JSON inválido', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: async () => {
                throw new SyntaxError('Unexpected end of JSON input');
            },
        } as unknown as Response);
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await expect(provider.send(baseMessage)).rejects.toBeInstanceOf(
            EmailTemporaryError,
        );
    });

    it('lanza EmailTemporaryError si la respuesta 2xx no trae id', async () => {
        const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, {}));
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await expect(provider.send(baseMessage)).rejects.toBeInstanceOf(
            EmailTemporaryError,
        );
    });

    it('lanza EmailTemporaryError si fetch aborta por timeout', async () => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        const fetchMock = jest.fn().mockRejectedValue(abortError);
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await expect(provider.send(baseMessage)).rejects.toBeInstanceOf(
            EmailTemporaryError,
        );
    });

    it('pasa un AbortSignal a fetch para poder cortar por timeout', async () => {
        const fetchMock = makeSuccessFetch();
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await provider.send(baseMessage);

        expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it('retryAfterSeconds es undefined (no NaN) si el header retry-after no es numérico', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValue(
                jsonResponse(429, { message: 'rate limited' }, { 'retry-after': 'not-a-number' }),
            );
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await expect(provider.send(baseMessage)).rejects.toMatchObject({
            retryAfterSeconds: undefined,
        });
    });

    it('retryAfterSeconds es undefined (no 0) si el header retry-after está ausente', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValue(jsonResponse(429, { message: 'rate limited' }));
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await expect(provider.send(baseMessage)).rejects.toMatchObject({
            retryAfterSeconds: undefined,
        });
    });

    it('retryAfterSeconds es undefined si el header retry-after está vacío', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValue(
                jsonResponse(429, { message: 'rate limited' }, { 'retry-after': '' }),
            );
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await expect(provider.send(baseMessage)).rejects.toMatchObject({
            retryAfterSeconds: undefined,
        });
    });

    it('retryAfterSeconds es undefined si el header retry-after es negativo', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValue(
                jsonResponse(429, { message: 'rate limited' }, { 'retry-after': '-5' }),
            );
        const provider = new ResendEmailProvider(
            baseOptions,
            fetchMock as unknown as typeof fetch,
        );

        await expect(provider.send(baseMessage)).rejects.toMatchObject({
            retryAfterSeconds: undefined,
        });
    });

    describe('409 de idempotencia', () => {
        it('mapea concurrent_idempotent_requests a EmailTemporaryError (retryable)', async () => {
            const fetchMock = jest
                .fn()
                .mockResolvedValue(
                    jsonResponse(409, { name: 'concurrent_idempotent_requests' }),
                );
            const provider = new ResendEmailProvider(
                baseOptions,
                fetchMock as unknown as typeof fetch,
            );

            await expect(provider.send(baseMessage)).rejects.toBeInstanceOf(
                EmailTemporaryError,
            );
        });

        it('mapea invalid_idempotent_request a EmailPermanentRejectionError', async () => {
            const fetchMock = jest
                .fn()
                .mockResolvedValue(
                    jsonResponse(409, { name: 'invalid_idempotent_request' }),
                );
            const provider = new ResendEmailProvider(
                baseOptions,
                fetchMock as unknown as typeof fetch,
            );

            await expect(provider.send(baseMessage)).rejects.toBeInstanceOf(
                EmailPermanentRejectionError,
            );
        });

        it('un 409 sin body parseable cae a EmailPermanentRejectionError', async () => {
            const fetchMock = jest.fn().mockResolvedValue({
                ok: false,
                status: 409,
                headers: { get: () => null },
                json: async () => {
                    throw new SyntaxError('bad json');
                },
            } as unknown as Response);
            const provider = new ResendEmailProvider(
                baseOptions,
                fetchMock as unknown as typeof fetch,
            );

            await expect(provider.send(baseMessage)).rejects.toBeInstanceOf(
                EmailPermanentRejectionError,
            );
        });
    });
});
