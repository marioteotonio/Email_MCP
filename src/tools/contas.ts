import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { schemaAdicionarConta, schemaRemoverConta } from "../schemas.js";
import type { ConfigService } from "../services/config.js";
import { z } from "zod";

export function registrarFerramentasContas(server: McpServer, config: ConfigService) {
  // --- Listar Contas ---
  server.tool(
    "email_listar_contas",
    "Lista todas as contas de email configuradas. Retorna ID, nome e endereço de cada conta.",
    z.object({}).strict().shape,
    async () => {
      const contas = config.obterContas();
      if (contas.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: "Nenhuma conta configurada. Use email_adicionar_conta para adicionar uma conta de email.",
          }],
        };
      }

      const lista = contas.map((c) => ({
        id: c.id,
        nome: c.nome,
        email: c.auth.user,
        imap: `${c.imap.host}:${c.imap.port}`,
        smtp: `${c.smtp.host}:${c.smtp.port}`,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(lista, null, 2) }],
      };
    }
  );

  // --- Adicionar Conta ---
  server.tool(
    "email_adicionar_conta",
    "Adiciona uma nova conta de email. Suporta Gmail (imap.gmail.com), Outlook (outlook.office365.com), Locaweb e qualquer provedor IMAP/SMTP. Para Gmail, use uma 'Senha de App' gerada nas configurações de segurança do Google.",
    schemaAdicionarConta.shape,
    async (params) => {
      config.adicionarConta({
        id: params.id,
        nome: params.nome,
        imap: {
          host: params.imapHost,
          port: params.imapPort,
          secure: params.imapSecure,
        },
        smtp: {
          host: params.smtpHost,
          port: params.smtpPort,
          secure: params.smtpSecure,
        },
        auth: {
          user: params.usuario,
          pass: params.senha,
        },
      });

      return {
        content: [{
          type: "text" as const,
          text: `Conta '${params.id}' (${params.nome}) adicionada com sucesso!\nEmail: ${params.usuario}\nIMAP: ${params.imapHost}:${params.imapPort}\nSMTP: ${params.smtpHost}:${params.smtpPort}`,
        }],
      };
    }
  );

  // --- Remover Conta ---
  server.tool(
    "email_remover_conta",
    "Remove uma conta de email configurada e todos os filtros associados a ela.",
    schemaRemoverConta.shape,
    async (params) => {
      if (!params.confirmar) {
        return {
          content: [{
            type: "text" as const,
            text: "Operação cancelada. Para confirmar a remoção, envie confirmar: true.",
          }],
        };
      }

      const conta = config.obterContaOuErro(params.contaId);
      config.removerConta(params.contaId);

      return {
        content: [{
          type: "text" as const,
          text: `Conta '${conta.id}' (${conta.nome}) removida com sucesso. Filtros associados também foram removidos.`,
        }],
      };
    }
  );
}
