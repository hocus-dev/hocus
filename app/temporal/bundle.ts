import { bundleWorkflowCode, type WorkflowBundleWithSourceMap } from "@temporalio/worker";

export async function generateTemporalCodeBundle(
  workflowsPath = "~/agent/workflows",
): Promise<WorkflowBundleWithSourceMap> {
  return await bundleWorkflowCode({
    workflowsPath: require.resolve(workflowsPath),
    payloadConverterPath: require.resolve("~/temporal/data-converter"),
    webpackConfigHook: (config) => {
      ((config.resolve as any).alias as any)["~"] = "/app";
      return config;
    },
  });
}
