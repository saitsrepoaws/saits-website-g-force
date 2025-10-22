# Amplify Backend CLI (Gen 2) Commands

- CLI reference (React): https://docs.amplify.aws/react/reference/cli-commands/
- Install/Run ad-hoc:
  - `pnpm dlx @aws-amplify/backend-cli sandbox`
  - `pnpm dlx @aws-amplify/backend-cli deploy`

## Common
- `sandbox`: creates a per-developer temporary backend, ideal for local dev/testing.
- `deploy`: provisions the backend to a persistent environment.
- Outputs file (e.g. `amplify_outputs.json`) is consumed by the client via `Amplify.configure(outputs)`.
