import { FlatCompat } from "@eslint/eslintrc"
import pluginQuery from "@tanstack/eslint-plugin-query"

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
})

export default [
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript", "prettier"],
  }),
  ...pluginQuery.configs["flat/recommended"],
]
