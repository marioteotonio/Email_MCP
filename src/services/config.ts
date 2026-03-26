import { homedir } from "node:os";
import { join } from "node:path";
import type { ContaEmail, FiltroEmail, ConfiguracaoServidor } from "../types.js";
import {
  type PersistenceBackend,
  FilePersistence,
  UpstashPersistence,
} from "./persistence.js";

const CONFIG_DEFAULT: ConfiguracaoServidor = {
  contas: [],
  filtros: [],
};

export class ConfigService {
  private config: ConfiguracaoServidor;
  private backend: PersistenceBackend | null;

  private constructor(config: ConfiguracaoServidor, backend: PersistenceBackend | null) {
    this.config = config;
    this.backend = backend;
  }

  static async create(): Promise<ConfigService> {
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const jsonEnv = process.env.EMAIL_MCP_CONFIG_JSON;

    // Priority 1: Upstash Redis (persistent cloud storage)
    if (upstashUrl && upstashToken) {
      const backend = new UpstashPersistence(upstashUrl, upstashToken);
      const config = await backend.load();
      console.error("ConfigService: usando Upstash Redis para persistência");
      return new ConfigService(config ?? { ...CONFIG_DEFAULT }, backend);
    }

    // Priority 2: JSON env var (read-only, no persistence)
    if (jsonEnv) {
      try {
        const parsed = JSON.parse(jsonEnv) as Partial<ConfiguracaoServidor>;
        const config = {
          contas: parsed.contas ?? [],
          filtros: parsed.filtros ?? [],
        };
        console.error("ConfigService: usando EMAIL_MCP_CONFIG_JSON (somente leitura)");
        return new ConfigService(config, null);
      } catch {
        // fall through
      }
    }

    // Priority 3: Local file
    const filePath =
      process.env.EMAIL_MCP_CONFIG ||
      join(homedir(), ".email-mcp", "config.json");
    const backend = new FilePersistence(filePath);
    const config = await backend.load();
    console.error(`ConfigService: usando arquivo local ${filePath}`);
    return new ConfigService(config ?? { ...CONFIG_DEFAULT }, backend);
  }

  // --- Leitura (sync — lê da memória) ---

  obterContas(): ContaEmail[] {
    return this.config.contas;
  }

  obterConta(id: string): ContaEmail | undefined {
    return this.config.contas.find((c) => c.id === id);
  }

  obterContaOuErro(id: string): ContaEmail {
    const conta = this.obterConta(id);
    if (!conta) {
      throw new Error(
        `Conta '${id}' não encontrada. Use email_listar_contas para ver as contas disponíveis.`
      );
    }
    return conta;
  }

  obterFiltros(contaId?: string): FiltroEmail[] {
    if (contaId) {
      return this.config.filtros.filter((f) => f.contaId === contaId);
    }
    return this.config.filtros;
  }

  // --- Escrita (async — persiste remotamente) ---

  private async salvar(): Promise<void> {
    if (this.backend) {
      await this.backend.save(this.config);
    }
  }

  async adicionarConta(conta: ContaEmail): Promise<void> {
    if (this.obterConta(conta.id)) {
      throw new Error(`Já existe uma conta com o ID '${conta.id}'.`);
    }
    this.config.contas.push(conta);
    await this.salvar();
  }

  async removerConta(id: string): Promise<void> {
    const idx = this.config.contas.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw new Error(`Conta '${id}' não encontrada.`);
    }
    this.config.contas.splice(idx, 1);
    this.config.filtros = this.config.filtros.filter((f) => f.contaId !== id);
    await this.salvar();
  }

  async adicionarFiltro(filtro: FiltroEmail): Promise<void> {
    this.obterContaOuErro(filtro.contaId);
    this.config.filtros.push(filtro);
    await this.salvar();
  }

  async removerFiltro(id: string): Promise<void> {
    const idx = this.config.filtros.findIndex((f) => f.id === id);
    if (idx === -1) {
      throw new Error(`Filtro '${id}' não encontrado.`);
    }
    this.config.filtros.splice(idx, 1);
    await this.salvar();
  }
}
