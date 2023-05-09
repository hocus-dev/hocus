import type { GenericProviderMap, ProvidersFns, ProvidersOverrides } from "./di/injector.server";
import { Injector, Scope } from "./di/injector.server";
import { overrideProviders } from "./di/utils.server";
import { GitService } from "./git/git.service";
import { InitService } from "./init/init.service.server";
import { LicenseService } from "./license/license.service";
import { PerfService } from "./perf.service.server";
import { ProjectService } from "./project/project.service";
import { SshKeyService } from "./ssh-key/ssh-key.service";
import { clientFactory } from "./temporal/client-factory";
import { TimeService } from "./time.service";
import { WorkspaceService } from "./workspace/workspace.service";

import { config } from "~/config";
import { newLogger } from "~/logger.server";
import { Token } from "~/token";
import { UserService } from "~/user/user.service.server";

type Providers = typeof providers;
type ProviderMap = GenericProviderMap<Providers>;
type ProviderFnMap = ProvidersFns<ProviderMap>;
type ProviderOverrides = ProvidersOverrides<Providers>;
export type AppInjector = Injector<Providers, ProviderMap, ProviderFnMap>;

const providers = [
  { token: Token.Config, provide: { value: config } },
  { token: Token.TimeService, provide: { class: TimeService } },
  { token: Token.Logger, provide: { factory: newLogger }, scope: Scope.Transient },
  { token: Token.PerfService, provide: { class: PerfService } },
  { token: Token.LicenseService, provide: { class: LicenseService } },
  { token: Token.SshKeyService, provide: { class: SshKeyService } },
  { token: Token.GitService, provide: { class: GitService } },
  { token: Token.UserService, provide: { class: UserService } },
  { token: Token.ProjectService, provide: { class: ProjectService } },
  { token: Token.TemporalClient, provide: { factory: clientFactory } },
  { token: Token.WorkspaceService, provide: { class: WorkspaceService } },
  { token: Token.InitService, provide: { class: InitService } },
] as const;

export const createAppInjector = (overrides?: ProviderOverrides): AppInjector => {
  const overriddenProviders = overrideProviders(providers, overrides ?? {});
  return new Injector(overriddenProviders);
};
