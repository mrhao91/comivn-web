// FIX: This file is intentionally simplified to only include typings for process.env,
// which is used in the application via Vite's `define` feature.
// The default vite/client reference has been removed to resolve a project-specific type resolution error.

// Augment the global NodeJS namespace to include API_KEY in ProcessEnv.
// This ensures TypeScript recognizes process.env.API_KEY.
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    [key: string]: any;
  }
}
