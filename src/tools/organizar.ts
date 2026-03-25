import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  schemaMoverEmail,
  schemaExcluirEmail,
  schemaContaPastaUid,
  schemaMarcarFavorito,
} from "../schemas.js";
import type { ConfigService } from "../services/config.js";
import * as imap from "../services/imap-client.js";

export function registrarFerramentasOrganizar(server: McpServer, config: ConfigService) {
  // --- Mover Email ---
  server.tool(
    "email_mover_email",
    "Move um email de uma pasta para outra. Use email_listar_pastas para ver as pastas disponíveis.",
    schemaMoverEmail.shape,
    async (params) => {
      const conta = config.obterContaOuErro(params.contaId);
      await imap.moverEmail(conta, params.pasta, params.uid, params.pastaDestino);

      return {
        content: [{
          type: "text" as const,
          text: `Email (UID: ${params.uid}) movido de '${params.pasta}' para '${params.pastaDestino}' na conta '${conta.nome}'.`,
        }],
      };
    }
  );

  // --- Excluir Email ---
  server.tool(
    "email_excluir_email",
    "Exclui um email. Por padrão, move para a lixeira. Use permanente: true para excluir definitivamente.",
    schemaExcluirEmail.shape,
    async (params) => {
      const conta = config.obterContaOuErro(params.contaId);
      await imap.excluirEmail(conta, params.pasta, params.uid, params.permanente);

      const acao = params.permanente ? "excluído permanentemente" : "movido para a lixeira";
      return {
        content: [{
          type: "text" as const,
          text: `Email (UID: ${params.uid}) ${acao} na conta '${conta.nome}'.`,
        }],
      };
    }
  );

  // --- Marcar como Lido ---
  server.tool(
    "email_marcar_lido",
    "Marca um email como lido.",
    schemaContaPastaUid.shape,
    async (params) => {
      const conta = config.obterContaOuErro(params.contaId);
      await imap.marcarLido(conta, params.pasta, params.uid);

      return {
        content: [{
          type: "text" as const,
          text: `Email (UID: ${params.uid}) marcado como lido na conta '${conta.nome}'.`,
        }],
      };
    }
  );

  // --- Marcar como Não Lido ---
  server.tool(
    "email_marcar_nao_lido",
    "Marca um email como não lido.",
    schemaContaPastaUid.shape,
    async (params) => {
      const conta = config.obterContaOuErro(params.contaId);
      await imap.marcarNaoLido(conta, params.pasta, params.uid);

      return {
        content: [{
          type: "text" as const,
          text: `Email (UID: ${params.uid}) marcado como não lido na conta '${conta.nome}'.`,
        }],
      };
    }
  );

  // --- Marcar como Favorito ---
  server.tool(
    "email_marcar_favorito",
    "Marca ou desmarca um email como favorito (estrela/flag). Use favorito: true para marcar e false para desmarcar.",
    schemaMarcarFavorito.shape,
    async (params) => {
      const conta = config.obterContaOuErro(params.contaId);
      await imap.marcarFavorito(conta, params.pasta, params.uid, params.favorito);

      const acao = params.favorito ? "marcado como favorito" : "desmarcado como favorito";
      return {
        content: [{
          type: "text" as const,
          text: `Email (UID: ${params.uid}) ${acao} na conta '${conta.nome}'.`,
        }],
      };
    }
  );
}
