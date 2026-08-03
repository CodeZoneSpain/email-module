/**
 * Entrada raíz: solo TS puro (core + providers), sin NestJS. Un consumidor
 * que no use Nest puede importar de acá sin arrastrar `@nestjs/common`.
 * Para la integración con Nest, importar de '@codezone/email/nestjs'.
 * Para la suite de tests de contrato, de '@codezone/email/testing'.
 */
export * from './core';
export * from './providers';
