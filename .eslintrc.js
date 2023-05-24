module.exports = {
  plugins: ["filename-rules", "eslint-plugin-n"],
  ignorePatterns: [
    "node_modules/**/*",
    "public/**/*",
    "build/**/*",
    "ops/**/*",
    "deps/**/*",
    "agent-build/**/*",
  ],
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
    // {
    //   files: ["app/routes/**/*.ts", "app/routes/**/*.tsx"],
    //   parserOptions: {
    //     project: "./tsconfig.json",
    //   },
    //   rules: {
    //     "no-restricted-syntax": [
    //       "warn",
    //       {
    //         selector:
    //           ":matches([id.name='loader'], [id.name='action']):not([init.callee.name='handleRouteErrors'])",
    //         message: "Always wrap your loader and action functions in handleRouteErrors",
    //       },
    //     ],
    //   },
    // },
    {
      files: ["*.ts", "*.tsx"],
      extends: ["@remix-run/eslint-config", "@remix-run/eslint-config/node"],
      parserOptions: {
        project: ["./tsconfig.json"], // Specify it only for TypeScript files
      },
      rules: {
        "n/no-sync": ["error", { allowAtRootLevel: true }],
        "n/prefer-global/console": ["error", "always"],
        "n/prefer-global/process": ["error", "always"],
        "n/prefer-global/text-decoder": ["error", "always"],
        "n/prefer-global/text-encoder": ["error", "always"],
        "n/prefer-global/url": ["error", "always"],
        "n/prefer-global/url-search-params": ["error", "always"],
        "n/prefer-promises/fs": "error",
        "n/prefer-promises/dns": "error",
        "n/no-unsupported-features/node-builtins": ["error"],
        "n/no-unsupported-features/es-syntax": ["error"],
        "n/no-unsupported-features/es-builtins": ["error"],
        "n/no-path-concat": ["error"],
        "n/no-deprecated-api": ["error"],
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { args: "after-used", argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
        camelcase: ["warn"],
        "@typescript-eslint/no-redeclare": "off",
        "@typescript-eslint/no-empty-function": ["error", { allow: ["arrowFunctions"] }],
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-base-to-string": "warn",
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
                message:
                  "Please use the client from the request context instead, or if just importing for types, use Prisma.NonTransactionClient",
                allowTypeImports: false,
              },
            ],
          },
        ],
        "@typescript-eslint/require-array-sort-compare": ["warn", { ignoreStringArrays: true }],
      },
    },
  ],
};
