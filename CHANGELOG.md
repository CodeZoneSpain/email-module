# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/). Versionado según [SemVer](https://semver.org/lang/es/).

## [0.2.0] - 2026-08-03

### Añadido
- `ResendEmailProvider` — primer adapter real (https://resend.com/docs/api-reference/emails/send-email), sin el SDK oficial, vía `fetch` nativo de Node 20+. Exportado desde la raíz del paquete (no necesita entrada separada, no le suma dependencias a nadie que no lo use).
- Mapea la respuesta HTTP de Resend a la jerarquía de errores del core: `401/403 → EmailProviderAuthError`, `429 → EmailRateLimitedError` (con `retryAfterSeconds` del header `retry-after`), `5xx → EmailTemporaryError`, otros `4xx → EmailPermanentRejectionError`, fallo de red → `EmailTemporaryError` (nunca reenvía el error crudo).

### Decisión de diseño
- Resend (como la mayoría de proveedores reales) no da éxito parcial por request — un solo POST se acepta o se rechaza entero. `ResendEmailProvider` filtra direcciones con formato inválido **antes** de llamar a la API (mismo criterio que `InMemoryEmailProvider`), para poder cumplir igual el contrato compartido de éxito parcial sin desperdiciar un request que Resend rechazaría entero por una sola dirección mala.

## [0.1.1] - 2026-08-03

### Corregido
- `dist/` ahora se commitea al repo, y se sacó el script `prepare` (`npm run build` al instalar). Antes, instalar este paquete como dependencia git ejecutaba `tsc` durante el `npm install` anidado — que rompe en cualquier instalación `--production`/`--prod` (como la imagen runtime de un Dockerfile multi-stage), porque ese modo no instala devDependencies y por lo tanto no existe `tsc`. Confirmado en la práctica: el build de `madfightstadium` fallaba con `ERR_PNPM_PREPARE_PACKAGE ... tsc: not found` al construir la imagen final.

## [0.1.0] - 2026-08-03

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
