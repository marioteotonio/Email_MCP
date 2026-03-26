import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { ConfiguracaoServidor } from "../types.js";

export interface PersistenceBackend {
  load(): Promise<ConfiguracaoServidor | null>;
  save(config: ConfiguracaoServidor): Promise<void>;
}

// ─── File-based persistence (local / default) ───

export class FilePersistence implements PersistenceBackend {
  constructor(private filePath: string) {}

  async load(): Promise<ConfiguracaoServidor | null> {
    try {
      if (!existsSync(this.filePath)) return null;
      const raw = readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw) as ConfiguracaoServidor;
    } catch {
      return null;
    }
  }

  async save(config: ConfiguracaoServidor): Promise<void> {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(config, null, 2), "utf-8");
  }
}

// ─── Upstash Redis persistence (cloud) ───

const REDIS_KEY = "email-mcp-config";

export class UpstashPersistence implements PersistenceBackend {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/$/, "");
    this.token = token;
  }

  async load(): Promise<ConfiguracaoServidor | null> {
    try {
      const res = await fetch(`${this.url}/get/${REDIS_KEY}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { result: string | null };
      if (!data.result) return null;
      return JSON.parse(data.result) as ConfiguracaoServidor;
    } catch (err) {
      console.error("Erro ao carregar config do Upstash:", err);
      return null;
    }
  }

  async save(config: ConfiguracaoServidor): Promise<void> {
    try {
      const res = await fetch(`${this.url}/set/${REDIS_KEY}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([JSON.stringify(config)]),
      });
      if (!res.ok) {
        console.error("Erro ao salvar config no Upstash:", res.status, await res.text());
      }
    } catch (err) {
      console.error("Erro ao salvar config no Upstash:", err);
    }
  }
}
