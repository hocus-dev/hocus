import { encryptText, decryptText } from "./encryption";

test.concurrent("encrypts and decrypts a string", async () => {
  const text = "test";
  const key = "not-a-secret";
  const encrypted = await encryptText(text, key);
  const decrypted = await decryptText(encrypted, key);
  expect(decrypted).toBe(text);
});
