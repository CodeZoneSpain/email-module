# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/). Versionado según [SemVer](https://semver.org/lang/es/).

## [0.1.0] - Sin publicar

### Añadido
- Core agnóstico de framework y de proveedor: `EmailMessage` (con `EmailContent` discriminado entre `html`/`text`), `EmailAddress`, `EmailAttachment`, `EmailSendResult`, `EmailProviderPort`.
- Jerarquía de errores tipados (`EmailError` base): `EmailValidationError`, `EmailConfigurationError`, `EmailProviderAuthError`, `EmailRateLimitedError`, `EmailTemporaryError`, `EmailPermanentRejectionError` — cada uno con `retryable` explícito.
- `validateEmailMessage()` — validación estructural universal (destinatarios, `from`/`replyTo`, contenido, adjuntos), independiente de cualquier proveedor.
- `SendEmailUseCase` — único use case que aporta el paquete; transporta el mensaje sin conocer conceptos de negocio.
- `InMemoryEmailProvider` — adapter de referencia para tests automatizados, con copia defensiva profunda y cálculo de `accepted`/`rejected` sobre `to`+`cc`+`bcc`.
- `runEmailProviderContractTests()` — suite de tests de comportamiento reutilizable por cualquier adapter nuevo (`@codezone/email/testing`).
- `EmailModule` (NestJS) con `forRoot`/`forRootAsync`, en entrada separada (`@codezone/email/nestjs`) para no forzar `@nestjs/common` a consumidores que no usan Nest.
- Entradas de paquete independientes vía `exports` (`.`, `./nestjs`, `./testing`).
- Soporte de peer `@nestjs/common` `^10.0.0 || ^11.0.0`, opcional.

### Decisiones de diseño
- Sin `kind: 'template'` en `EmailContent` — ambiguo sin un proveedor real delante; se reintroduce si aparece un caso concreto.
- Sin reintentos automáticos dentro del módulo — `send()` es un único intento, el llamador decide.
- Sin envío programado — no todos los proveedores lo soportan igual y no hay forma de simularlo de forma significativa en un adapter fake.
- `idempotencyKey` documentado como mejor esfuerzo, no garantizado por todos los adapters.
