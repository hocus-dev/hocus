import { FirecrackerService } from "./firecracker.service";

export const greet = async (name: string): Promise<string> => {
  const fc = new FirecrackerService("/tmp/fc.sock");
  await fc.createVM();
  return `Hello, ${name}! I started a VM for you!`;
};
