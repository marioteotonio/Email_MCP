import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { schemaListarEmails, schemaContaPastaUid, schemaBuscarEmails } from "../schemas.js";
import type { ConfigService } from "../services/config.js";
import * as imap from "../services/imap-client.js";

export function registrarFerramentasEmails(server: McpServer, config: ConfigService) {
  // --- Listar Emails ---
  server.tool(
    "email_listar_emails",
    "Lista emails de uma pasta com paginação. Retorna os mais recentes primeiro, com resumo de cada email (assunto, remetente, data, status de leitura).",
    schemaListarEmails.shape,
    async (params) => {
      const conta = config.obterContaOuErro(params.contaId);
      const resultado = await imap.listarEmails(
        conta,
        params.pasta,
        params.pagina,
        params.porPagina
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            conta: conta.nome,
            pasta: params.pasta,
            pagina: resultado.pagina,
            porPagina: resultado.porPagina,
            total: resultado.total,
            totalPaginas: resultado.totalPaginas,
            emails: resultado.itens,
          }, null, 2),
        }],
      };
    }
  );

  // --- Ler Email ---
  server.tool(
    "email_ler_email",
    "Lê o conteúdo completo de um email específico, incluindo corpo (texto e HTML), anexos, cabeçalhos e referências. O email é identificado pelo seu UID na pasta.",
    schemaContaPastaUid.shape,
    async (params) => {
      const conta = config.obterContaOuErro(params.contaId);
      const email = await imap.lerEmail(conta, params.pasta, params.uid);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            conta: conta.nome,
            ...email,
          }, null, 2),
        }],
      };
    }
  );

  // --- Buscar Emails ---
  server.tool(
    "email_buscar_emails",
    "Busca emails em uma pasta usando critérios como remetente, destinatário, assunto, corpo, datas e status de leitura. Retorna os mais recentes primeiro.",
    schemaBuscarEmails.shape,
    async (params) => {
      const conta = config.obterContaOuErro(params.contaId);

      const criterios = {
        de: params.de,
        para: params.para,
        assunto: params.assunto,
        corpo: params.corpo,
        texto: params.texto,
        desde: params.desde,
        ate: params.ate,
        lido: params.lido,
      };

      const emails = await imap.buscarEmails(
        conta,
        params.pasta,
        criterios,
        params.limite
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            conta: conta.nome,
            pasta: params.pasta,
            totalResultados: emails.length,
            emails,
          }, null, 2),
        }],
      };
    }
  );
}
