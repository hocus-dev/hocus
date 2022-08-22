module.exports = {
  plugins: ["@typescript-eslint", "filename-rules"],
  ignorePatterns: ["node_modules/**/*", "public/**/*", "build/**/*"],
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      extends: [
        "@remix-run/eslint-config",
        "@remix-run/eslint-config/node",
        "plugin:@typescript-eslint/recommended",
      ],
      parserOptions: {
        project: ["./tsconfig.json"], // Specify it only for TypeScript files
      },
      rules: {
        "@typescript-eslint/no-redeclare": "off",
        "@typescript-eslint/no-empty-function": ["error", { allow: ["arrowFunctions"] }],
        "@typescript-eslint/no-floating-promises": "error",
        "no-console": "warn",
        "filename-rules/match": [
          "warn",
          /^[a-z0-9\-]+(\.[a-z0-9\-]+)?(\.test)?\.((tsx)|(ts)|(d\.ts))$/,
        ],
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
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "@prisma/client",
                importNames: ["PrismaClient"],
                message: "Please use the client from the request context instead.",
              },
              {
                name: "@remix-run/node",
                importNames: ["json", "useActionData", "useLoaderData"],
                message: "Please use the corresponding item from '~/remix-superjson' instead.",
              },
            ],
          },
        ],
      },
    },
  ],
};
