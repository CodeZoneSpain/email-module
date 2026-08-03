# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/). Versionado según [SemVer](https://semver.org/lang/es/).

## [0.2.1] - 2026-08-03

### Corregido
- `ResendEmailProvider` podía mandar `to: []` a la API cuando la única dirección de `to` era inválida pero `cc`/`bcc` tenían alguna válida — Resend exige `to` no vacío y hubiera rechazado el request entero. Ahora se valida explícitamente antes de llamar.
- Una respuesta 2xx con JSON inválido o sin `id` ya no puede colarse como `SyntaxError` ni como `messageId: undefined` — se valida y se mapea a `EmailTemporaryError`.
- `apiKey` vacío y `defaultFrom.email` con formato inválido ahora fallan en el constructor (`EmailConfigurationError`) en vez de en el primer `send()` fallido — el adapter se valida a sí mismo, no depende de que cada consumidor lo valide antes de instanciarlo.
- `timeoutMs` inválido (negativo, `0`, `Infinity`, no entero) ahora falla en el constructor (`EmailConfigurationError`) — antes podía hacer que `AbortSignal.timeout()` tirara y esa excepción se mapeaba incorrectamente a `EmailTemporaryError`, un error de config disfrazado de error transitorio.
- Un 409 de Resend por `concurrent_idempotent_requests` (otra request con la misma `Idempotency-Key` todavía en curso) ahora mapea a `EmailTemporaryError` (retryable) en vez de `EmailPermanentRejectionError` — se sigue tratando como permanente un `invalid_idempotent_request` (mismo key, payload distinto) o cualquier 409 sin ese campo reconocible. **Nota:** no pude confirmar contra la documentación en vivo de Resend en qué campo exacto del JSON viaja ese código (su doc no muestra un ejemplo de body) — se revisan `name`/`type`/`code` de forma defensiva; si Resend usa otro nombre de campo, cae al comportamiento previo (permanente), no se rompe nada, pero convendría confirmarlo con un 409 real cuando aparezca uno.
- `retryAfterSeconds` (en `EmailRateLimitedError`) ahora es `undefined` si el header `retry-after` no es numérico, está vacío, es negativo, **o está ausente** — `Number(null) === 0` y `Number.isFinite(0) === true`, así que un header ausente se colaba como `retryAfterSeconds: 0` en vez de `undefined`. Confirmado corriendo el JS compilado antes y después del fix.

### Añadido
- Timeout configurable (`timeoutMs`, default 10s) vía `AbortSignal.timeout()` — un fetch colgado ya no puede bloquear indefinidamente. Mapea a `EmailTemporaryError`.
- `EmailMessage.idempotencyKey` ahora se manda como header `Idempotency-Key` (soportado nativamente por Resend, dedup 24h). Se valida el máximo de 256 caracteres de Resend (`EmailValidationError` si se excede).
- `message.from` con formato de dirección inválido ahora se valida explícitamente (`EmailValidationError`).

### Decisión de diseño
- `EmailMessage.tags` (`string[]`) no se manda a Resend — su API espera pares `{name, value}` y no hay una conversión no-ambigua entre ambos shapes. Mandar algo inventado sería tan arbitrario como omitirlo. Si se necesita de verdad, hay que rediseñar `tags` en el core primero.

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
