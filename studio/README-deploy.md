Sanity Studio auto-deploy

This repository includes a GitHub Action that will deploy the Sanity Studio automatically when you push to `main`.

What it does:
- On push to `main`, the workflow will checkout the repo, install studio dependencies, and run `npx sanity deploy --yes` in the `studio/` folder.

Prerequisites:
1. Create a deploy token in Sanity with the "deploy" permission:
   - Go to https://www.sanity.io/manage -> select your project -> API -> Tokens -> "Add token"
   - Choose role: "deploy" and copy the token.
2. Add the token to your GitHub repository secrets as `SANITY_AUTH_TOKEN`.
   - Repo -> Settings -> Secrets and variables -> Actions -> New repository secret

Notes:
- The CLI login is not required for the GitHub Action because it uses the token.
- If you prefer preview deploys or different branches, adjust the workflow's `on` trigger and `npx sanity deploy` flags.
