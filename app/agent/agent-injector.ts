import { DefaultLogger } from "@temporalio/worker";

import { AgentUtilService } from "./agent-util.service";
import { BlockRegistryService } from "./block-registry/registry.service";
import { BuildfsService } from "./buildfs.service";
import { AgentGitService } from "./git/git.service";
import { SSHGatewayService } from "./network/ssh-gateway.service";
import { LowLevelStorageService, StorageService } from "./network/storage/storage.service";
import { WorkspaceNetworkService } from "./network/workspace-network.service";
import { PrebuildService } from "./prebuild.service";
import { ProjectConfigService } from "./project-config/project-config.service";
import { factoryFirecrackerService } from "./runtime/firecracker-legacy/firecracker.service";
import { factoryQemuService } from "./runtime/qemu/qemu.service";
import { WorkspaceAgentService } from "./workspace-agent.service";

import { config } from "~/config";
import type { GenericProviderMap, ProvidersFns, ProvidersOverrides } from "~/di/injector.server";
import { Injector, Scope } from "~/di/injector.server";
import { overrideProviders } from "~/di/utils.server";
import { GitService } from "~/git/git.service";
import { PerfService } from "~/perf.service.server";
import { ProjectService } from "~/project/project.service";
import { SshKeyService } from "~/ssh-key/ssh-key.service";
import { clientFactory } from "~/temporal/client-factory";
import { TimeService } from "~/time.service";
import { Token } from "~/token";
import { WorkspaceService } from "~/workspace/workspace.service";

type Providers = typeof providers;
type ProviderMap = GenericProviderMap<Providers>;
type ProviderFnMap = ProvidersFns<ProviderMap>;
export type AgentProviderOverrides = ProvidersOverrides<Providers>;
export type AgentInjector = Injector<Providers, ProviderMap, ProviderFnMap>;

const providers = [
  { token: Token.Config, provide: { value: config } },
  { token: Token.TimeService, provide: { class: TimeService } },
  { token: Token.Logger, provide: { class: DefaultLogger }, scope: Scope.Transient },
  { token: Token.PerfService, provide: { class: PerfService } },
  { token: Token.BlockRegistryService, provide: { class: BlockRegistryService } },
  { token: Token.LowLevelStorageService, provide: { class: LowLevelStorageService } },
  { token: Token.StorageService, provide: { class: StorageService } },
  { token: Token.AgentUtilService, provide: { class: AgentUtilService } },
  { token: Token.WorkspaceService, provide: { class: WorkspaceService } },
  { token: Token.SshKeyService, provide: { class: SshKeyService } },
  { token: Token.GitService, provide: { class: GitService } },
  { token: Token.AgentGitService, provide: { class: AgentGitService } },
  { token: Token.ProjectService, provide: { class: ProjectService } },
  { token: Token.ProjectConfigService, provide: { class: ProjectConfigService } },
  { token: Token.BuildfsService, provide: { class: BuildfsService } },
  { token: Token.PrebuildService, provide: { class: PrebuildService } },
  { token: Token.SSHGatewayService, provide: { class: SSHGatewayService } },
  { token: Token.WorkspaceNetworkService, provide: { class: WorkspaceNetworkService } },
  { token: Token.FirecrackerService, provide: { factory: factoryFirecrackerService } },
  { token: Token.QemuService, provide: { factory: factoryQemuService } },
  { token: Token.WorkspaceAgentService, provide: { class: WorkspaceAgentService } },
  { token: Token.TemporalClient, provide: { factory: clientFactory } },
] as const;

export const createAgentInjector = (overrides?: AgentProviderOverrides): AgentInjector => {
  const overriddenProviders = overrideProviders(providers, overrides ?? {});
  return new Injector(overriddenProviders);
};
