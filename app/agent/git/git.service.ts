import type { Logger } from "@temporalio/worker";
import type { ValidationError } from "~/schema/utils.server";
import { Token } from "~/token";

import { execCmd } from "../utils";

import { RemoteInfoTupleValidator } from "./validator";

export interface GitRemoteInfo {
  /** The name of the remote, e.g. `refs/heads/master` */
  name: string;
  /** The hash of the object the remote is pointing to, in other words
   * commit hash. E.g. `8e5423e991e8cd0988d0c4a3f4ac4ca1af7d148a` */
  hash: string;
}

interface ParseError {
  error: ValidationError;
  value: string;
}

export class GitService {
  static inject = [Token.Logger] as const;

  constructor(private readonly logger: Logger) {}

  private parseLsRemoteOutput(output: string): {
    remotes: GitRemoteInfo[];
    errors: ParseError[];
  } {
    const remotes: GitRemoteInfo[] = [];
    const errors: ParseError[] = [];

    output
      .toString()
      .split("\n")
      .filter((line) => line.length > 0)
      .forEach((line) => {
        const words = line.split(/\s/);
        const result = RemoteInfoTupleValidator.SafeParse(words);
        if (result.success) {
          const value = result.value;
          remotes.push({ hash: value[0], name: value[1] });
        } else {
          errors.push({ error: result.error, value: line });
        }
      });

    return { remotes, errors };
  }

  async getRemotes(repositoryUrl: string): Promise<GitRemoteInfo[]> {
    const output = await execCmd("git", "ls-remote", repositoryUrl);
    const result = this.parseLsRemoteOutput(output.stdout.toString());
    for (const { error, value } of result.errors) {
      this.logger.error(
        `Failed to parse git ls-remote output:\n${error.message}\nOffending value: "${value}"`,
      );
    }
    return result.remotes;
  }
}
