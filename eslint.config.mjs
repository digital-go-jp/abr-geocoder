import node from "eslint-plugin-node";
import prettier from "eslint-plugin-prettier";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: [
        "**/node_modules",
        "**/dist",
        "**/build",
        "**/*.spec.ts",
        "**/*.specs.ts",
        "**/*.test.ts",
        ".*/*",
        "./coverage/**",
        "**/jest.config.ts",
        "**/__test__",
        "**/__tests__",
        "**/__mock__",
        "**/__mocks__",
        "**/__skip__",
        "**/__skips__",
        "**/experimental/",
    ],
}, ...compat.extends("eslint:recommended", "plugin:node/recommended", "prettier"), {
    plugins: {
        node,
        prettier,
    },

    rules: {
        "block-scoped-var": "error",
        eqeqeq: "error",
        "no-var": "error",
        "prefer-const": "error",
        "eol-last": "error",
        "prefer-arrow-callback": "error",
        "no-trailing-spaces": "error",

        quotes: ["warn", "single", {
            avoidEscape: true,
        }],

        "no-restricted-properties": ["error", {
            object: "describe",
            property: "only",
        }, {
            object: "it",
            property: "only",
        }],

        "no-underscore-dangle": ["error"],
        "prettier/prettier": "error",
    },
}, ...compat.extends("plugin:@typescript-eslint/recommended").map(config => ({
    ...config,
    files: ["**/*.ts"],
})), {
    files: ["**/*.ts"],

    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2018,
        sourceType: "module",
    },

    rules: {
        "@typescript-eslint/no-namespace": "off",
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/no-warning-comments": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/ban-types": "off",
        "@typescript-eslint/camelcase": "off",
        "node/no-missing-import": "off",
        "node/no-empty-function": "off",
        "node/no-unsupported-features/es-syntax": "off",
        "node/no-missing-require": "off",
        "node/shebang": "off",
        "no-dupe-class-members": "off",
        "require-atomic-updates": "off",
    },
}];