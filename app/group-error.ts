export class GroupError extends Error {
  constructor(public readonly errors: Error[]) {
    super(`Group error: ${errors.map((e) => e.message).join(", ")}`);
  }
}
