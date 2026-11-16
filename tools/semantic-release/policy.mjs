/** Retain semantic-release's pull-request skip and local dry-run defaults. */
export function applyCiPolicy(options, { isCi, isPr = false }) {
  const resolved = { ...options };
  const noCi = resolved.ci === false || resolved.noCi;
  if (!isCi && !resolved.dryRun && !noCi) resolved.dryRun = true;
  return { options: resolved, skip: !!(isCi && isPr && !noCi) };
}
