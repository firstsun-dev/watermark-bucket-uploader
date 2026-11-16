# Release tooling security remediation

The semantic-release distribution installs an npm publishing plugin even when npm publishing is disabled. npm bundles vulnerable glob and minimatch dependencies that ordinary dependency overrides cannot replace.

## Approved approach

Use the official `@semantic-release/core`, pinned to `1.0.0-beta.1`, with the local `semantic-release` workspace package in `tools/semantic-release`. Its package version supplies the existing plugins' semantic-release 25 peer contract; it is a project adapter, not the upstream distribution. The prerelease core pin was explicitly approved.

Declare the commit analyzer and release notes generator explicitly. Retain main's pnpm 12.14.0 tooling, conventional-commit policies, pull-request skip policy, local dry-run default, and metadata-only release workflow. Artifact building and uploading remain in the existing separate release-build workflow.

The local prepare hook updates package.json, manifest.json and versions.json. pnpm-lock.yaml does not store the root package version; leave it byte-for-byte unchanged and retain it in release commit assets. Dependency updates are resolved and committed before releases.

## Validation

A frozen pnpm install and audit must show zero vulnerabilities including development dependencies. Tests must cover invalid CLI arguments, dry-run behavior, pull-request skipping, plugin loading, version synchronization and unchanged pnpm resolution. Run `./init.sh`, zero-warning lint and `pnpm audit`. No real release or push is performed during release-tooling validation.
