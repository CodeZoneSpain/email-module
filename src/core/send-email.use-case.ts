import { EmailProviderPort } from './email-provider.port';
import { EmailMessage } from './email-message';
import { EmailSendResult } from './email-result';

/**
 * Único use case que aporta el paquete compartido: transporta el mensaje.
 * No sabe de "reset password", "oferta" ni ningún concepto de negocio —
 * eso vive en cada app consumidora, que arma el EmailMessage y llama a esto.
 */
export class SendEmailUseCase {
    constructor(private readonly provider: EmailProviderPort) {}

    execute(message: EmailMessage): Promise<EmailSendResult> {
        return this.provider.send(message);
    }
}
