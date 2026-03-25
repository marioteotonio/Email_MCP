import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { ContaEmail, FiltroEmail, ConfiguracaoServidor } from "../types.js";

const CONFIG_DEFAULT: ConfiguracaoServidor = {
  contas: [],
  filtros: [],
};

export class ConfigService {
  private configPath: string;
  private config: ConfiguracaoServidor;

  constructor() {
    this.configPath =
      process.env.EMAIL_MCP_CONFIG ||
      join(homedir(), ".email-mcp", "config.json");

    this.config = this.carregar();
  }

  // --- Leitura / Escrita ---

  private carregar(): ConfiguracaoServidor {
    try {
      // Suporte a config via env var (para deploy em cloud com filesystem efêmero)
      const jsonEnv = process.env.EMAIL_MCP_CONFIG_JSON;
      if (jsonEnv) {
        const parsed = JSON.parse(jsonEnv) as Partial<ConfiguracaoServidor>;
        return {
          contas: parsed.contas ?? [],
          filtros: parsed.filtros ?? [],
        };
      }

      if (!existsSync(this.configPath)) {
        this.criarConfigPadrao();
        return { ...CONFIG_DEFAULT };
      }
      const raw = readFileSync(this.configPath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<ConfiguracaoServidor>;
      return {
        contas: parsed.contas ?? [],
        filtros: parsed.filtros ?? [],
      };
    } catch {
      return { ...CONFIG_DEFAULT };
    }
  }

  private salvar(): void {
    const dir = dirname(this.configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf-8");
  }

  private criarConfigPadrao(): void {
    const dir = dirname(this.configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.configPath, JSON.stringify(CONFIG_DEFAULT, null, 2), "utf-8");
  }

  // --- Contas ---

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

  adicionarConta(conta: ContaEmail): void {
    if (this.obterConta(conta.id)) {
      throw new Error(`Já existe uma conta com o ID '${conta.id}'.`);
    }
    this.config.contas.push(conta);
    this.salvar();
  }

  removerConta(id: string): void {
    const idx = this.config.contas.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw new Error(`Conta '${id}' não encontrada.`);
    }
    this.config.contas.splice(idx, 1);
    // Remove filtros associados
    this.config.filtros = this.config.filtros.filter((f) => f.contaId !== id);
    this.salvar();
  }

  // --- Filtros ---

  obterFiltros(contaId?: string): FiltroEmail[] {
    if (contaId) {
      return this.config.filtros.filter((f) => f.contaId === contaId);
    }
    return this.config.filtros;
  }

  adicionarFiltro(filtro: FiltroEmail): void {
    this.obterContaOuErro(filtro.contaId);
    this.config.filtros.push(filtro);
    this.salvar();
  }

  removerFiltro(id: string): void {
    const idx = this.config.filtros.findIndex((f) => f.id === id);
    if (idx === -1) {
      throw new Error(`Filtro '${id}' não encontrado.`);
    }
    this.config.filtros.splice(idx, 1);
    this.salvar();
  }
}
