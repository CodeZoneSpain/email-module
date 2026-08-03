import {
    DynamicModule,
    InjectionToken,
    Module,
    ModuleMetadata,
    OptionalFactoryDependency,
    Provider,
} from '@nestjs/common';
import { EmailProviderPort } from '../core/email-provider.port';
import { SendEmailUseCase } from '../core/send-email.use-case';
import { EMAIL_PROVIDER } from './email.constants';

export interface EmailModuleOptions {
    provider: EmailProviderPort;
}

export interface EmailModuleAsyncOptions {
    imports?: ModuleMetadata['imports'];
    inject?: (InjectionToken | OptionalFactoryDependency)[];
    useFactory: (
        ...args: any[]
    ) => EmailProviderPort | Promise<EmailProviderPort>;
}

const sendEmailUseCaseProvider: Provider = {
    provide: SendEmailUseCase,
    useFactory: (provider: EmailProviderPort) => new SendEmailUseCase(provider),
    inject: [EMAIL_PROVIDER],
};

@Module({})
export class EmailModule {
    static forRoot(options: EmailModuleOptions): DynamicModule {
        return {
            module: EmailModule,
            providers: [
                { provide: EMAIL_PROVIDER, useValue: options.provider },
                sendEmailUseCaseProvider,
            ],
            exports: [EMAIL_PROVIDER, SendEmailUseCase],
        };
    }

    static forRootAsync(options: EmailModuleAsyncOptions): DynamicModule {
        return {
            module: EmailModule,
            imports: options.imports ?? [],
            providers: [
                {
                    provide: EMAIL_PROVIDER,
                    useFactory: options.useFactory,
                    inject: options.inject ?? [],
                },
                sendEmailUseCaseProvider,
            ],
            exports: [EMAIL_PROVIDER, SendEmailUseCase],
        };
    }
}
