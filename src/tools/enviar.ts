import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { schemaEnviarEmail, schemaResponderEmail, schemaEncaminharEmail } from "../schemas.js";
import type { ConfigService } from "../services/config.js";
import { enviarEmail } from "../services/smtp-client.js";
import { lerEmail } from "../services/imap-client.js";

export function registrarFerramentasEnviar(server: McpServer, config: ConfigService) {
  // --- Enviar Email ---
  server.tool(
    "email_enviar_email",
    "Envia um novo email a partir de uma conta configurada. Suporta múltiplos destinatários, CC, BCC e corpo em texto puro ou HTML.",
    schemaEnviarEmail.shape,
    async (params) => {
      const conta = config.obterContaOuErro(params.contaId);

      const messageId = await enviarEmail(conta, {
        para: params.para,
        cc: params.cc,
        bcc: params.bcc,
        assunto: params.assunto,
        corpo: params.corpo,
        html: params.html,
      });

      return {
        content: [{
          type: "text" as const,
          text: `Email enviado com sucesso!\nDe: ${conta.auth.user}\nPara: ${Array.isArray(params.para) ? params.para.join(", ") : params.para}\nAssunto: ${params.assunto}\nMessage-ID: ${messageId}`,
        }],
      };
    }
  );

  // --- Responder Email ---
  server.tool(
    "email_responder_email",
    "Responde a um email existente. Mantém o encadeamento da conversa (thread) automaticamente. Use responderTodos: true para responder a todos os destinatários.",
    schemaResponderEmail.shape,
    async (params) => {
      const conta = config.obterContaOuErro(params.contaId);

      // Ler email original para obter dados de threading
      const original = await lerEmail(conta, params.pasta, params.uid);

      // Determinar destinatários
      let para: string;
      let cc: string | undefined;

      if (params.responderTodos) {
        para = original.de;
        const todosDestinatarios = [
          ...original.para,
          ...original.cc,
        ].filter((e) => !e.includes(conta.auth.user));
        if (todosDestinatarios.length > 0) {
          cc = todosDestinatarios.join(", ");
        }
      } else {
        para = original.de;
      }

      // Montar assunto com Re:
      const assunto = original.assunto.startsWith("Re:")
        ? original.assunto
        : `Re: ${original.assunto}`;

      // Montar referências para threading
      const refs = original.referencias
        ? `${original.referencias} ${original.messageId}`
        : original.messageId;

      const messageId = await enviarEmail(conta, {
        para,
        cc,
        assunto,
        corpo: params.corpo,
        html: params.html,
        responderA: original.messageId,
        referencias: refs,
      });

      return {
        content: [{
          type: "text" as const,
          text: `Resposta enviada com sucesso!\nDe: ${conta.auth.user}\nPara: ${para}${cc ? `\nCC: ${cc}` : ""}\nAssunto: ${assunto}\nMessage-ID: ${messageId}`,
        }],
      };
    }
  );

  // --- Encaminhar Email ---
  server.tool(
    "email_encaminhar_email",
    "Encaminha um email existente para outro(s) destinatário(s). O conteúdo original é incluído na mensagem.",
    schemaEncaminharEmail.shape,
    async (params) => {
      const conta = config.obterContaOuErro(params.contaId);

      // Ler email original
      const original = await lerEmail(conta, params.pasta, params.uid);

      // Montar assunto com Fwd:
      const assunto = original.assunto.startsWith("Fwd:")
        ? original.assunto
        : `Fwd: ${original.assunto}`;

      // Montar corpo com cabeçalho de encaminhamento
      const cabecalho = [
        "---------- Mensagem encaminhada ----------",
        `De: ${original.de}`,
        `Data: ${original.data}`,
        `Assunto: ${original.assunto}`,
        `Para: ${original.para.join(", ")}`,
        original.cc.length > 0 ? `CC: ${original.cc.join(", ")}` : "",
        "-------------------------------------------",
        "",
      ]
        .filter(Boolean)
        .join("\n");

      const corpoCompleto = params.corpo
        ? `${params.corpo}\n\n${cabecalho}\n${original.corpoTexto}`
        : `${cabecalho}\n${original.corpoTexto}`;

      let htmlCompleto: string | undefined;
      if (original.corpoHtml) {
        const cabecalhoHtml = `
          <br/><br/>
          <div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 5px;">
            <p><b>---------- Mensagem encaminhada ----------</b><br/>
            De: ${original.de}<br/>
            Data: ${original.data}<br/>
            Assunto: ${original.assunto}<br/>
            Para: ${original.para.join(", ")}
            ${original.cc.length > 0 ? `<br/>CC: ${original.cc.join(", ")}` : ""}
            </p>
            ${original.corpoHtml}
          </div>`;
        htmlCompleto = params.corpo
          ? `<p>${params.corpo.replace(/\n/g, "<br/>")}</p>${cabecalhoHtml}`
          : cabecalhoHtml;
      }

      const messageId = await enviarEmail(conta, {
        para: params.para,
        assunto,
        corpo: corpoCompleto,
        html: htmlCompleto,
      });

      return {
        content: [{
          type: "text" as const,
          text: `Email encaminhado com sucesso!\nDe: ${conta.auth.user}\nPara: ${Array.isArray(params.para) ? params.para.join(", ") : params.para}\nAssunto: ${assunto}\nMessage-ID: ${messageId}`,
        }],
      };
    }
  );
}
