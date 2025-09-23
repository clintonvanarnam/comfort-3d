import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'o7wwoccn',
    dataset: 'production'
  },
  /**
   * Deployment options for auto-updating studios.
   *
   * To enable automatic updates for the core Studio runtime (recommended):
   *  - Add `deployment.autoUpdates: true` so the Studio can auto-update patches/minors.
   *  - Optionally add an `appId` (create under your project's "Studio" tab in sanity.io/manage)
   *    if you want fine-grained version/channel selection (latest/next/stable) from the dashboard.
   *
   * See: https://www.sanity.io/docs/studio/latest-version-of-sanity
   */
  deployment: {
    // appId: '<your-studio-app-id>', // optional: set this if you want channel/version selection via the dashboard
    autoUpdates: true,
  },
})
