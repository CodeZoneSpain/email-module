import { EmailProviderPort } from '../email-provider.port';
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
export declare function runEmailProviderContractTests(adapterName: string, makeProvider: () => EmailProviderPort): void;
