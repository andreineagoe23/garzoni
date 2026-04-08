/** Vite injects `import.meta.env`; RN/Metro builds omit it (caught at runtime in readPublicEnv). */
interface ImportMeta {
  readonly env?: Record<string, string | boolean | undefined>;
}
