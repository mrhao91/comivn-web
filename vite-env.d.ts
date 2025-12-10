/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_KEY: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Augment the global NodeJS namespace to include API_KEY in ProcessEnv.
// This prevents "Cannot redeclare block-scoped variable 'process'" errors
// while ensuring TypeScript recognizes process.env.API_KEY.
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    [key: string]: any;
  }
}
