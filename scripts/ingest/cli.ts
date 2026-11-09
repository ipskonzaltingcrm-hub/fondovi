/* CLI ulaz za ingestion (lokalno / GitHub Actions). Pokretanje: `npm run ingest`. */
import { runIngest } from "./run";

// Lokalno: učitaj .env.local (u CI-u varijable dolaze iz GitHub Secreta).
try {
  (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.(
    ".env.local",
  );
} catch {
  /* nema .env.local (npr. CI) — koristi postojeće env varijable */
}

runIngest()
  .then((s) => {
    // svi izvori pali → fail (CI crveni)
    if (s.total > 0 && s.failures === s.total) process.exit(1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
