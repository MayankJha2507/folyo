import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "public/**"],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      /*
       * Access-path fence (docs/PLAN.md §4). The service-role client bypasses
       * RLS, so it may only be imported from the audited admin modules. Any
       * other import is a security defect and fails CI.
       */
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db/admin", "@/lib/db/admin/*", "**/lib/db/admin"],
              message:
                "The service-role client bypasses RLS. Import it only inside src/lib/db/admin/** (see docs/PLAN.md §4). User-facing code must use @/lib/db/user or @/lib/db/txn.",
            },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // The fenced modules and their tests are the one place the fence lifts.
    files: ["src/lib/db/admin/**", "tests/**"],
    rules: { "no-restricted-imports": "off" },
  },
];

export default config;
