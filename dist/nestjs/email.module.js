"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var EmailModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailModule = void 0;
const common_1 = require("@nestjs/common");
const send_email_use_case_1 = require("../core/send-email.use-case");
const email_constants_1 = require("./email.constants");
const sendEmailUseCaseProvider = {
    provide: send_email_use_case_1.SendEmailUseCase,
    useFactory: (provider) => new send_email_use_case_1.SendEmailUseCase(provider),
    inject: [email_constants_1.EMAIL_PROVIDER],
};
let EmailModule = EmailModule_1 = class EmailModule {
    static forRoot(options) {
        return {
            module: EmailModule_1,
            providers: [
                { provide: email_constants_1.EMAIL_PROVIDER, useValue: options.provider },
                sendEmailUseCaseProvider,
            ],
            exports: [email_constants_1.EMAIL_PROVIDER, send_email_use_case_1.SendEmailUseCase],
        };
    }
    static forRootAsync(options) {
        return {
            module: EmailModule_1,
            imports: options.imports ?? [],
            providers: [
                {
                    provide: email_constants_1.EMAIL_PROVIDER,
                    useFactory: options.useFactory,
                    inject: options.inject ?? [],
                },
                sendEmailUseCaseProvider,
            ],
            exports: [email_constants_1.EMAIL_PROVIDER, send_email_use_case_1.SendEmailUseCase],
        };
    }
};
exports.EmailModule = EmailModule;
exports.EmailModule = EmailModule = EmailModule_1 = __decorate([
    (0, common_1.Module)({})
], EmailModule);
