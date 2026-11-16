import release, { getLogger, resolveConfig, resolveEnvCi } from "@semantic-release/core";
import { applyCiPolicy } from "./policy.mjs";

/** Compatibility entry point for this project's configured release plugins. */
export default async function semanticRelease(runtimeOptions = {}, runtime = {}) {
  const cwd = runtime.cwd ?? process.cwd();
  const env = { ...(runtime.env ?? process.env) };
  const context = {
    cwd,
    env,
    stdout: runtime.stdout ?? process.stdout,
    stderr: runtime.stderr ?? process.stderr,
    envCi: resolveEnvCi({ cwd, env }),
  };
  context.logger = getLogger(context);
  const { options } = await resolveConfig(context, runtimeOptions);
  const policy = applyCiPolicy(options, context.envCi);
  if (policy.skip) {
    context.logger.log("Skipping release for a pull request.");
    return false;
  }
  // Build with the original config source so nested shared-config plugins keep their resolution paths.
  const configured = await resolveConfig(context, { ...runtimeOptions, dryRun: policy.options.dryRun }, { buildPlugins: true });
  context.options = configured.options;
  Object.assign(env, {
    GIT_AUTHOR_NAME: env.GIT_AUTHOR_NAME || "semantic-release-bot",
    GIT_AUTHOR_EMAIL: env.GIT_AUTHOR_EMAIL || "semantic-release-bot@martynus.net",
    GIT_COMMITTER_NAME: env.GIT_COMMITTER_NAME || "semantic-release-bot",
    GIT_COMMITTER_EMAIL: env.GIT_COMMITTER_EMAIL || "semantic-release-bot@martynus.net",
    GIT_ASKPASS: "echo",
    GIT_TERMINAL_PROMPT: "0",
  });
  return release({ context, plugins: configured.plugins });
}
