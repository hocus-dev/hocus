export class GroupError extends Error {
  constructor(public readonly errors: unknown[]) {
    super(
      `Group error: ${errors
        .map((e) => (e instanceof Error ? e.message : `unknown error: ${String(e)}`))
        .join(", ")}`,
    );
  }
}
