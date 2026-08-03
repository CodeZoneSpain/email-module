# @codezone/email

No maneja correo entrante ni respuestas — solo envío. No sabe nada de negocio (ofertas, reset de contraseña, etc.): eso vive en cada app consumidora, que arma un `EmailMessage` y lo manda.

## Instalación

Como dependencia git, apuntando siempre a un tag, nunca a una rama:

```json
{
  "dependencies": {
    "@codezone/email": "git+ssh://git@github.com/CodeZoneSpain/email-module.git#v0.1.0"
  }
}
```

Mientras el repo no esté publicado, se puede usar localmente con `npm install <ruta-absoluta>` (equivalente a una dependencia `file:`).

## Entradas del paquete

El paquete expone tres entradas independientes — importar solo la que se necesita evita cargar dependencias de más:

| Import                    | Contenido                                                                               | Requiere `@nestjs/common` |
| ------------------------- | --------------------------------------------------------------------------------------- | ------------------------- |
| `@codezone/email`         | Core (tipos, puerto, errores, `SendEmailUseCase`) + `InMemoryEmailProvider`             | No                        |
| `@codezone/email/nestjs`  | `EmailModule` (`forRoot`/`forRootAsync`)                                                | Sí                        |
| `@codezone/email/testing` | `runEmailProviderContractTests` — suite de tests de comportamiento para adapters nuevos | No                        |

## Uso — sin NestJS

```ts
import { InMemoryEmailProvider, SendEmailUseCase } from "@codezone/email";

const provider = new InMemoryEmailProvider();
const sendEmail = new SendEmailUseCase(provider);

const result = await sendEmail.execute({
  to: { email: "user@example.com" },
  subject: "Bienvenido",
  content: { kind: "html", html: "<p>Hola</p>", text: "Hola" },
});
// result: { messageId, provider, accepted, rejected }
```

## Uso — con NestJS

```ts
import { EmailModule } from "@codezone/email/nestjs";
import { InMemoryEmailProvider, ResendEmailProvider } from "@codezone/email";

@Module({
  imports: [
    // dev/test — no envía nada real
    EmailModule.forRoot({ provider: new InMemoryEmailProvider() }),

    // producción — async, leyendo config/secretos
    // EmailModule.forRootAsync({
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) =>
    //     new ResendEmailProvider({
    //       apiKey: config.get('RESEND_API_KEY'),
    //       defaultFrom: { email: config.get('EMAIL_FROM_ADDRESS') },
    //     }),
    // }),
  ],
})
export class AppModule {}
```

## Adapters incluidos

| Adapter | Para qué | Notas |
|---|---|---|
| `InMemoryEmailProvider` | Tests automatizados, dev/staging sin proveedor real | No envía nada — guarda en `sentEmails` |
| `ResendEmailProvider` | Producción, vía [Resend](https://resend.com) | Sin SDK, usa `fetch` nativo. `defaultFrom` opcional si cada `EmailMessage` ya trae su propio `from`. Filtra direcciones con formato inválido antes de llamar a la API — Resend no da éxito parcial por request. |

`SendEmailUseCase` queda disponible para inyectar en cualquier use case de la app consumidora:

```ts
constructor(private readonly sendEmail: SendEmailUseCase) {}
```

## El contrato: `EmailMessage` → `EmailSendResult`

```ts
interface EmailMessage {
  to: EmailAddress | EmailAddress[];
  from?: EmailAddress;
  replyTo?: EmailAddress;
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  content:
    | { kind: "html"; html: string; text?: string }
    | { kind: "text"; text: string };
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
  idempotencyKey?: string; // mejor esfuerzo, no garantizado por todos los proveedores
  metadata?: { category?: string; sensitive?: boolean; [key: string]: unknown };
}

interface EmailSendResult {
  messageId: string;
  provider?: string;
  accepted: string[]; // direcciones aceptadas, de to+cc+bcc
  rejected: string[]; // direcciones rechazadas, de to+cc+bcc
}
```

No existe `kind: 'template'` — la app consumidora renderiza su propio HTML/text (con su idioma, marca y reglas de negocio) y lo manda como `html`/`text`. Se puede reintroducir el día que haya un caso concreto que lo justifique.

`metadata` viaja tal cual a los adapters y puede quedar persistido (ej. en un futuro log de desarrollo en Postgres) — se asume JSON-serializable, no poner credenciales ahí. `metadata.sensitive: true` marca mensajes con contenido sensible (ej. un token de reset) para que adapters de inspección los redacten.

## Reglas de comportamiento (verificadas por el contrato de tests)

- `send()` es un único intento — nunca reintenta internamente. El llamador decide la estrategia de reintento según `EmailError.retryable`.
- Al menos un destinatario aceptado → devuelve `EmailSendResult` normal (puede traer algunos en `rejected`).
- Todos los destinatarios rechazados → lanza `EmailPermanentRejectionError`.
- Fallo temporal del proveedor (red, 5xx) → `EmailTemporaryError` (`retryable: true`).
- Límite de frecuencia del proveedor → `EmailRateLimitedError` (`retryable: true`, con `retryAfterSeconds` opcional).
- Un adapter nunca debe reenviar el mensaje de error crudo de un SDK externo como `message` de un `EmailError` — puede contener credenciales o detalles internos del proveedor.

## Escribir un adapter nuevo

1. Implementar `EmailProviderPort` (`send(message): Promise<EmailSendResult>`).
2. Llamar a `validateEmailMessage(message)` al comienzo de `send()`.
3. En el `.spec.ts` del adapter, llamar a `runEmailProviderContractTests('MiAdapter', () => new MiAdapter(...))` — si no pasa el contrato, no es un adapter válido para este módulo.

`InMemoryEmailProvider` (`src/providers/in-memory-email-provider.ts`) es el ejemplo de referencia: guarda los envíos en `sentEmails` (con copia defensiva, incluyendo `Buffer` de adjuntos) para aserciones en tests.

## Desarrollo

```bash
npm install
npm test        # jest
npm run lint     # eslint, sin --fix
npm run build    # tsc -p tsconfig.build.json → dist/
```
