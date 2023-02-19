import type { GitObject, Project, PrebuildEvent } from "@prisma/client";
import type { Number, Union } from "ts-toolbelt";

import type { CheckoutAndInspectResult } from "./activities-types";
import type { GetOrCreateBuildfsEventsReturnType } from "./buildfs.service";
import type { ArbitraryKeyMap } from "./utils/arbitrary-key-map.server";

import type { valueof } from "~/types/utils";

/**
 * Buildfs and Prebuild Workflow Phase
 */
export type BFSPWorkflowPhase = valueof<typeof BFSPWorkflowPhase>;
export const BFSPWorkflowPhase = {
  START: 0,
  AFTER_DB_FETCH: 10,
  AFTER_CHECKOUT: 20,
  AFTER_BUILDFS_EVENTS: 30,
  AFTER_PREBUILD_EVENTS: 40,
} as const;

type FromPhase<Gate extends number, CurrentPhase extends number, T> = Number.GreaterEq<
  CurrentPhase,
  Gate
> extends 1
  ? T
  : {};

type PhaseState = {
  [BFSPWorkflowPhase.START]: { gitBranchIds: bigint[] };
  [BFSPWorkflowPhase.AFTER_DB_FETCH]: { project: Project; gitObject: GitObject };
  [BFSPWorkflowPhase.AFTER_CHECKOUT]: { inspection: CheckoutAndInspectResult };
  [BFSPWorkflowPhase.AFTER_BUILDFS_EVENTS]: { buildfsEvent?: GetOrCreateBuildfsEventsReturnType };
  [BFSPWorkflowPhase.AFTER_PREBUILD_EVENTS]: {
    prebuildEvent: PrebuildEvent;
    sourceProjectDrivePath: string;
  };
};

/**
 * Buildfs and Prebuild Workflow State
 */
export type BFSPWorkflowState<Phase extends BFSPWorkflowPhase> = ArbitraryKeyMap<
  { projectId: bigint; gitObjectId: bigint },
  Union.Merge<valueof<{ [key in keyof PhaseState]: FromPhase<key, Phase, PhaseState[key]> }>>
>;
