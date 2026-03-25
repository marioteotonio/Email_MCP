import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { schemaContaId, schemaCriarPasta, schemaRenomearPasta, schemaExcluirPasta } from "../schemas.js";
import type { ConfigService } from "../services/config.js";
import * as imap from "../services/imap-client.js";

export function registrarFerramentasPastas(server: McpServer, config: ConfigService) {
  // --- Listar Pastas ---
  server.tool(
    "email_listar_pastas",
    "Lista todas as pastas (mailboxes) de uma conta de email, incluindo total de mensagens e não lidas.",
    schemaContaId.shape,
    async (params) => {
      const conta = config.obterContaOuErro(params.contaId);
      const pastas = await imap.listarPastas(conta);

      const resultado = pastas.map((p) => ({
        nome: p.nome,
        caminho: p.caminho,
        totalMensagens: p.totalMensagens,
        naoLidas: p.naoLidas,
        especialUso: p.especialUso || undefined,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(resultado, null, 2) }],
      };
    }
  );

  // --- Criar Pasta ---
  server.tool(
    "email_criar_pasta",
    "Cria uma nova pasta (mailbox) na conta de email. Suporta subpastas usando '/' como separador (ex: 'Projetos/ClienteX').",
    schemaCriarPasta.shape,
    async (params) => {
      const conta = config.obterContaOuErro(params.contaId);
      await imap.criarPasta(conta, params.caminho);

      return {
        content: [{
          type: "text" as const,
          text: `Pasta '${params.caminho}' criada com sucesso na conta '${conta.nome}'.`,
        }],
      };
    }
  );

  // --- Renomear Pasta ---
  server.tool(
    "email_renomear_pasta",
    "Renomeia ou move uma pasta existente na conta de email.",
    schemaRenomearPasta.shape,
    async (params) => {
      const conta = config.obterContaOuErro(params.contaId);
      await imap.renomearPasta(conta, params.caminhoAtual, params.novoCaminho);

      return {
        content: [{
          type: "text" as const,
          text: `Pasta renomeada de '${params.caminhoAtual}' para '${params.novoCaminho}' na conta '${conta.nome}'.`,
        }],
      };
    }
  );

  // --- Excluir Pasta ---
  server.tool(
    "email_excluir_pasta",
    "Exclui uma pasta da conta de email. ATENÇÃO: todos os emails dentro da pasta serão perdidos.",
    schemaExcluirPasta.shape,
    async (params) => {
      if (!params.confirmar) {
        return {
          content: [{
            type: "text" as const,
            text: "Operação cancelada. Para confirmar a exclusão, envie confirmar: true.",
          }],
        };
      }

      const conta = config.obterContaOuErro(params.contaId);
      await imap.excluirPasta(conta, params.caminho);

      return {
        content: [{
          type: "text" as const,
          text: `Pasta '${params.caminho}' excluída com sucesso da conta '${conta.nome}'.`,
        }],
      };
    }
  );
}
