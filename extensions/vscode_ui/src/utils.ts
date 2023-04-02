import * as child_process from "child_process";

export type valueof<T> = T[keyof T];
export const mapenum =
    <K extends string | number | symbol>() =>
        <V, T extends Record<K, V>>(map: T): { [key in K]: T[key] } =>
            map;

export const PLATFORM = process.platform;
export const isUnix = PLATFORM === "linux" || PLATFORM === "darwin";
export const isWindows = PLATFORM === "win32";

export async function waitForProcessOutput(command: string, args: string[]): Promise<{ stderr: string, stdout: string }> {
    const cp = child_process.spawn(command, args, { timeout: 2_000, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = "";
    let stderr = "";
    let ends = 0;
    await new Promise((resolve, reject) => {
        const endF = () => { ends += 1; if (ends == 2) { resolve(void 0); } };
        cp.on("error", (err) => reject(err));
        cp.stdout.setEncoding('utf8');
        cp.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        })
        cp.stdout.on("end", endF);
        cp.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        })
        cp.stderr.on("end", endF);
    });
    return { stdout, stderr };
}
