import { FirecrackerService } from "./firecracker.service";

export const greet = async (name: string): Promise<string> => {
  const fc = new FirecrackerService("/tmp/fc.sock");
  fc.startFirecrackerInstance({ stdout: "/tmp/fc.stdout", stderr: "/tmp/fc.stderr" });
  return `Hello, ${name}! I started a VM for you!`;
};
