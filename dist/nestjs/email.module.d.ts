import { DynamicModule, InjectionToken, ModuleMetadata, OptionalFactoryDependency } from '@nestjs/common';
import { EmailProviderPort } from '../core/email-provider.port';
export interface EmailModuleOptions {
    provider: EmailProviderPort;
}
export interface EmailModuleAsyncOptions {
    imports?: ModuleMetadata['imports'];
    inject?: (InjectionToken | OptionalFactoryDependency)[];
    useFactory: (...args: any[]) => EmailProviderPort | Promise<EmailProviderPort>;
}
export declare class EmailModule {
    static forRoot(options: EmailModuleOptions): DynamicModule;
    static forRootAsync(options: EmailModuleAsyncOptions): DynamicModule;
}
