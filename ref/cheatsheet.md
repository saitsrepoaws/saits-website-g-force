# Amplify Gen 2 + PubSub Cheat Sheet

## Monorepo basics
- **Install**
```bash
pnpm install
```
- **Dev (web)**
```bash
pnpm --filter web dev
```
- **Build (web)**
```bash
pnpm --filter web build
```
- **Lint / Typecheck**
```bash
pnpm lint
pnpm --filter web run typecheck
```

## Tailwind tips
- If you use `@layer components` in `apps/web/src/styles/theme.css`, ensure the file contains at the top:
```css
@tailwind components;
```
- Tailwind content includes styles dir via `apps/web/tailwind.config.cjs`:
```js
content: ['.//index.html', './src/**/*.{ts,tsx,js,jsx}', './src/styles/**/*.css']
```

## Amplify Gen 2 CLI
- Gen 2 backend CLI binary is `ampx` inside `@aws-amplify/backend-cli`.
- When using pnpm, specify the binary explicitly:
```bash
pnpm --package=@aws-amplify/backend-cli dlx ampx -v
```
- **Sandbox (once, write outputs to repo root)**
```bash
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --once --outputs-format json --outputs-out-dir .
```
- **Deploy (persistent env)**
```bash
pnpm --package=@aws-amplify/backend-cli dlx ampx deploy
```

## Outputs → Client wiring
- Copy outputs to the web public dir so the app can fetch them:
```bash
cp amplify_outputs.json apps/web/public/amplify_outputs.json
```
- The app configures Amplify at startup (see `apps/web/src/amplify-config.ts`) by fetching `/amplify_outputs.json`.
- Verify in browser: http://localhost:5173/amplify_outputs.json returns 200.

## Feature toggle (client)
- In `apps/web/.env.local`:
```ini
VITE_ENABLE_PUBSUB=true
```

## PubSub client
- We use `@aws-amplify/pubsub` in a small service: `apps/web/src/services/pubsub.ts`.
- API used:
```ts
import { PubSub } from '@aws-amplify/pubsub'
await PubSub.publish({ topics: ['iot/demo/topic'], message: { hello: 'world' }})
const sub = PubSub.subscribe({ topics: ['iot/demo/topic'] }).subscribe({ next: console.log })
```

## Auth UI / Routing
- `@aws-amplify/ui-react` Authenticator is shown at `/login`.
- Home `/` is protected by `AuthGate` (needs authenticated session).
- App is wrapped in `Authenticator.Provider` in `apps/web/src/main.tsx`.

## Backend layout (Gen 2)
- Root: `amplify/`
  - `backend.ts` – composes resources.
  - `auth/` – Auth resources (User Pool etc.).
  - Add identity & IoT policy in separate small modules to keep files < 400 LOC.

## Common errors & fixes
- **Engine mismatch (EBADENGINE)**: Use Node 22 LTS (via nvm) to satisfy packages.
```bash
nvm install 22 && nvm use 22 && nvm alias default 22
```
- **Global install EACCES**: Prefer `npx`/`pnpm dlx` instead of global `npm i -g`.
- **Multiple bins with pnpm dlx**:
```bash
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox
```
- **Region not bootstrapped**: Use Admin to bootstrap region or run sandbox with the correct `--profile`.
- **Tailwind `@layer components` error**: Add `@tailwind components;` to the top of the CSS file and restart dev.
- **Amplify not configured**: Ensure `/amplify_outputs.json` is reachable; app configures Amplify on boot.
- **Backend import errors**:
  - Avoid directory imports; import concrete files or a barrel with explicit path resolution supported by the builder.

### PubSub: `TypeError: PubSub.subscribe is not a function`
- **Cause**: Wrong import or missing package. In Amplify JS v6, use the PubSub category package and ensure the app is configured.
- **Fix**:
  - Install package in the web app:
    ```bash
    pnpm --filter web add @aws-amplify/pubsub
    ```
  - Import in code (service):
    ```ts
    import { PubSub } from '@aws-amplify/pubsub'
    ```
  - Configure in `apps/web/src/amplify-config.ts` (only pass allowed categories):
    ```ts
    Amplify.configure({
      Auth: { Cognito: { userPoolId, userPoolClientId, identityPoolId, region } },
      PubSub: { AWSIoT: { aws_pubsub_region: region, aws_pubsub_endpoint: 'wss://<endpoint>/mqtt' } },
    })
    ```
  - Vite env (app-level) in `apps/web/.env.local`:
    ```ini
    VITE_ENABLE_PUBSUB=true
    VITE_AWS_IOT_ENDPOINT=xxxx-ats.iot.<region>.amazonaws.com
    ```
  - Restart Vite after env changes.
  - Ensure permissions on the identity allow `iot:Connect`, `iot:Subscribe`, `iot:Publish`, `iot:Receive` for your topics.

## IoT policy reference
- See `ref/iot-policy-examples.md` for policy JSON allowing `iot:Connect`, `iot:Subscribe`, `iot:Publish`, `iot:Receive` on your topics.

## Docs links
- Gen 2 Docs Hub: https://docs.amplify.aws/
- CLI commands (backend-cli): https://docs.amplify.aws/react/reference/cli-commands/
- PubSub (Gen 2, React): https://docs.amplify.aws/react/build-a-backend/add-aws-services/pubsub/set-up-pubsub/
- PubSub (JS v6): https://docs.amplify.aws/lib/pubsub/getting-started/q/platform/js/
- IoT MQTT policy: https://docs.aws.amazon.com/iot/latest/developerguide/pub-sub-policy.html
