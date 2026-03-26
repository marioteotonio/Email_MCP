import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { schemaAdicionarConta, schemaAdicionarContaRapida, schemaRemoverConta } from "../schemas.js";
import type { ConfigService } from "../services/config.js";
import type { ConfigServidor } from "../types.js";
import { z } from "zod";

// Presets de provedores conhecidos
const PRESETS_PROVEDORES: Record<string, { imap: ConfigServidor; smtp: ConfigServidor }> = {
  gmail: {
    imap: { host: "imap.gmail.com", port: 993, secure: true },
    smtp: { host: "smtp.gmail.com", port: 587, secure: false },
  },
  outlook: {
    imap: { host: "outlook.office365.com", port: 993, secure: true },
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
  },
  hotmail: {
    imap: { host: "outlook.office365.com", port: 993, secure: true },
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
  },
  locaweb: {
    imap: { host: "email-ssl.com.br", port: 993, secure: true },
    smtp: { host: "email-ssl.com.br", port: 465, secure: true },
  },
  yahoo: {
    imap: { host: "imap.mail.yahoo.com", port: 993, secure: true },
    smtp: { host: "smtp.mail.yahoo.com", port: 465, secure: true },
  },
  icloud: {
    imap: { host: "imap.mail.me.com", port: 993, secure: true },
    smtp: { host: "smtp.mail.me.com", port: 587, secure: false },
  },
  zoho: {
    imap: { host: "imap.zoho.com", port: 993, secure: true },
    smtp: { host: "smtp.zoho.com", port: 465, secure: true },
  },
};

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
      await config.adicionarConta({
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

  // --- Adicionar Conta Rápida (com preset de provedor) ---
  server.tool(
    "email_adicionar_conta_rapida",
    "Adiciona conta de email usando presets de provedores conhecidos. Basta informar o provedor (gmail, outlook, hotmail, locaweb, yahoo, icloud, zoho), email e senha. Para Gmail/Outlook/Yahoo/iCloud, use App Password.",
    schemaAdicionarContaRapida.shape,
    async (params) => {
      const preset = PRESETS_PROVEDORES[params.provedor];
      if (!preset) {
        return {
          content: [{
            type: "text" as const,
            text: `Provedor '${params.provedor}' não reconhecido. Provedores suportados: ${Object.keys(PRESETS_PROVEDORES).join(", ")}. Para outros provedores, use email_adicionar_conta com configuração manual.`,
          }],
          isError: true,
        };
      }

      const emailUser = params.usuario;
      const localPart = emailUser.split("@")[0] ?? emailUser;
      const id = params.id ?? `${params.provedor}-${localPart}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const nome = params.nome ?? `${params.provedor.charAt(0).toUpperCase() + params.provedor.slice(1)} ${localPart}`;

      await config.adicionarConta({
        id,
        nome,
        imap: { ...preset.imap },
        smtp: { ...preset.smtp },
        auth: {
          user: emailUser,
          pass: params.senha,
        },
      });

      return {
        content: [{
          type: "text" as const,
          text: `Conta '${id}' (${nome}) adicionada com sucesso!\nEmail: ${emailUser}\nProvedor: ${params.provedor}\nIMAP: ${preset.imap.host}:${preset.imap.port}\nSMTP: ${preset.smtp.host}:${preset.smtp.port}`,
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
      await config.removerConta(params.contaId);

      return {
        content: [{
          type: "text" as const,
          text: `Conta '${conta.id}' (${conta.nome}) removida com sucesso. Filtros associados também foram removidos.`,
        }],
      };
    }
  );
}
