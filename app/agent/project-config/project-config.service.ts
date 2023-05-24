import path from "path";

import type { NodeSSH } from "node-ssh";
import yaml from "yaml";

import { execSshCmd } from "../utils";

import { HOCUS_CONFIG_FILE_NAMES } from "./constants";
import type { ProjectConfig } from "./validator";
import { ProjectConfigValidator } from "./validator";

import type { ValidationError } from "~/schema/utils.server";

export class ProjectConfigService {
  /**
   * Returns `[ProjectConfig, projectConfigPath]` for the given repository
   * if a hocus config file is present. If the config file is invalid, returns an error,
   * Otherwise, returns `null`.
   */
  async getConfig(
    ssh: NodeSSH,
    repositoryPath: string,
    rootDirectoryPath: string,
  ): Promise<[ProjectConfig, string] | null | ValidationError> {
    const configDir = path.join(repositoryPath, rootDirectoryPath);
    let configString: string | null = null;
    let configPath: string | null = null;
    for (const fileName of HOCUS_CONFIG_FILE_NAMES) {
      const catOutput = await execSshCmd(
        { ssh, allowNonZeroExitCode: true, opts: { cwd: configDir } },
        ["cat", fileName],
      );
      if (catOutput.code === 0) {
        configPath = path.join(configDir, fileName);
        configString = catOutput.stdout;
        break;
      } else if (!/No such file or directory/.test(catOutput.stderr)) {
        throw new Error(
          `Unexpected error when reading config file. Code: ${catOutput.code}, stderr: "${catOutput.stderr}"`,
        );
      }
    }
    if (configString === null || configPath === null) {
      return null;
    }
    const config = yaml.parse(configString);
    const { success, error, value: parsedConfig } = ProjectConfigValidator.SafeParse(config);
    if (!success) {
      return error;
    } else {
      return [parsedConfig, configPath];
    }
  }
}
