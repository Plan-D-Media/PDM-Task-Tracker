/**
 * Dev-only email + password login gate.
 *
 * `true` only in local development (`next dev`); `false` in any production
 * build. This is the runtime gate for the `devSignIn` server action — even
 * if the action were somehow invoked in production, it refuses.
 *
 * We gate on `NODE_ENV` ALONE (not a `NEXT_PUBLIC_*` flag) on purpose: it is
 * the one env value the bundler statically folds, which lets the production
 * build dead-code-eliminate the dev login form from the client bundle
 * entirely (an unset NEXT_PUBLIC flag stays a runtime lookup and defeats
 * that elimination, shipping the dead form into prod). The /login page
 * inlines the same `process.env.NODE_ENV` check so its `<DevLogin />` is
 * removed at build time, not merely hidden.
 */
export const DEV_LOGIN_ENABLED = process.env.NODE_ENV !== "production";
