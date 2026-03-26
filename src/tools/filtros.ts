import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { schemaCriarFiltro, schemaExcluirFiltro, schemaListarFiltros } from "../schemas.js";
import type { ConfigService } from "../services/config.js";
import { randomUUID } from "node:crypto";

export function registrarFerramentasFiltros(server: McpServer, config: ConfigService) {
  // --- Listar Filtros ---
  server.tool(
    "email_listar_filtros",
    "Lista os filtros de email configurados. Filtros são regras locais que definem ações automáticas (mover, marcar, excluir) baseadas em critérios como remetente, assunto, etc.",
    schemaListarFiltros.shape,
    async (params) => {
      const filtros = config.obterFiltros(params.contaId);

      if (filtros.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: params.contaId
              ? `Nenhum filtro configurado para a conta '${params.contaId}'.`
              : "Nenhum filtro configurado. Use email_criar_filtro para criar um.",
          }],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(filtros, null, 2) }],
      };
    }
  );

  // --- Criar Filtro ---
  server.tool(
    "email_criar_filtro",
    "Cria um filtro de email local. Filtros definem critérios (remetente, assunto, conteúdo) e ações (mover para pasta, marcar como lido, marcar favorito, excluir). Nota: filtros são armazenados localmente e podem ser aplicados manualmente.",
    schemaCriarFiltro.shape,
    async (params) => {
      // Verificar se a conta existe
      config.obterContaOuErro(params.contaId);

      const filtro = {
        id: randomUUID(),
        contaId: params.contaId,
        nome: params.nome,
        criterios: params.criterios,
        acao: params.acao,
        ativo: true,
      };

      await config.adicionarFiltro(filtro);

      return {
        content: [{
          type: "text" as const,
          text: `Filtro '${params.nome}' criado com sucesso!\nID: ${filtro.id}\nConta: ${params.contaId}\nCritérios: ${JSON.stringify(params.criterios)}\nAção: ${JSON.stringify(params.acao)}`,
        }],
      };
    }
  );

  // --- Excluir Filtro ---
  server.tool(
    "email_excluir_filtro",
    "Remove um filtro de email pelo seu ID.",
    schemaExcluirFiltro.shape,
    async (params) => {
      if (!params.confirmar) {
        return {
          content: [{
            type: "text" as const,
            text: "Operação cancelada. Para confirmar a exclusão, envie confirmar: true.",
          }],
        };
      }

      await config.removerFiltro(params.filtroId);

      return {
        content: [{
          type: "text" as const,
          text: `Filtro '${params.filtroId}' removido com sucesso.`,
        }],
      };
    }
  );
}
