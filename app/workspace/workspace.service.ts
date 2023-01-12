import type { Config } from "unique-names-generator";
import { uniqueNamesGenerator, adjectives, animals } from "unique-names-generator";

export class WorkspaceService {
  private nameGeneratorConfig: Config = {
    dictionaries: [adjectives, animals],
    length: 2,
    separator: " ",
    style: "capital",
  };

  generateWorkspaceName(): string {
    return uniqueNamesGenerator(this.nameGeneratorConfig);
  }
}
