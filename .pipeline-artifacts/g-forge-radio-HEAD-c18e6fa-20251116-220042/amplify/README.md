# Amplify Gen 2 Backend (code-first)

This folder defines the Amplify Gen 2 backend in TypeScript. Use the Backend CLI to create a per-developer sandbox or deploy persistent environments.

Common commands (run from repo root):

- Sandbox once (outputs as JSON to repo root):
  ```bash
  pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --once --outputs-format json --outputs-out-dir .
  ```
- Watch sandbox:
  ```bash
  pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox
  ```
- Deploy persistent env:
  ```bash
  pnpm --package=@aws-amplify/backend-cli dlx ampx deploy
  ```

After successful sandbox/deploy, the client app can import the generated outputs and call `Amplify.configure(outputs)`.
