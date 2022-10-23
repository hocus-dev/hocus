module.exports = {
  plugins: ["filename-rules"],
  ignorePatterns: ["node_modules/**/*", "public/**/*", "build/**/*", "ops/**/*"],
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      excludedFiles: ["app/routes/**/*.tsx", "app/components/**/*.tsx"],
      parserOptions: {
        project: "./tsconfig.json",
      },
      rules: {
        "filename-rules/match": [
          "warn",
          /^[a-z0-9\-]+(\.[a-z0-9\-]+)?(\.((test)|(d)|(server)|(client)|(shared)))?\.((ts)|(tsx))$/,
        ],
      },
    },
    {
      files: ["*.ts", "*.tsx"],
      extends: ["@remix-run/eslint-config", "@remix-run/eslint-config/node"],
      parserOptions: {
        project: ["./tsconfig.json"], // Specify it only for TypeScript files
      },
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { args: "after-used", argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
        camelcase: ["warn"],
        "@typescript-eslint/no-redeclare": "off",
        "@typescript-eslint/no-empty-function": ["error", { allow: ["arrowFunctions"] }],
        "@typescript-eslint/no-floating-promises": "error",
        "no-console": "warn",
        "import/order": [
          "warn",
          {
            alphabetize: {
              order: "asc",
              caseInsensitive: true,
            },
            "newlines-between": "always",
          },
        ],
        "@typescript-eslint/no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "@prisma/client",
                importNames: ["PrismaClient"],
                message: "Please use the client from the request context instead.",
                allowTypeImports: true,
              },
            ],
          },
        ],
      },
    },
  ],
};
