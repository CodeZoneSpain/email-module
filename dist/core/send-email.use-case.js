"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendEmailUseCase = void 0;
/**
 * Único use case que aporta el paquete compartido: transporta el mensaje.
 * No sabe de "reset password", "oferta" ni ningún concepto de negocio —
 * eso vive en cada app consumidora, que arma el EmailMessage y llama a esto.
 */
class SendEmailUseCase {
    constructor(provider) {
        this.provider = provider;
    }
    execute(message) {
        return this.provider.send(message);
    }
}
exports.SendEmailUseCase = SendEmailUseCase;
