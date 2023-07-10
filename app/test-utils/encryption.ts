export const encryptText = (text: string, key: string): string => {
  // xor the text with the key
  const xor = Buffer.from(text, "utf8").map(
    (byte, index) => byte ^ key.charCodeAt(index % key.length),
  );
  // return the encrypted text as base64
  return Buffer.from(xor).toString("base64");
};

export const decryptText = (text: string, key: string): string => {
  // xor the text with the key
  const xor = Buffer.from(text, "base64").map(
    (byte, index) => byte ^ key.charCodeAt(index % key.length),
  );
  // return the decrypted text as utf8
  return Buffer.from(xor).toString("utf8");
};
