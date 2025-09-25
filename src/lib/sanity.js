// src/lib/sanity.js
import { createClient } from '@sanity/client';

const client = createClient({
  projectId: 'o7wwoccn',        // ← your actual project ID
  dataset: 'production',       // ← your dataset
  apiVersion: '2023-01-01',    // use a fixed date
  useCdn: true,                // `false` if you want fresh data
});

export default client;