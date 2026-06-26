/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PARENT_API_URL?: string;
  readonly PARENT_API_URL?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
