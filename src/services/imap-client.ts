import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type {
  ContaEmail,
  PastaEmail,
  ResumoEmail,
  EmailCompleto,
  AnexoEmail,
  ResultadoPaginado,
  CriteriosBusca,
} from "../types.js";

// ============================================================
// Wrapper ImapFlow — conexão fresh por operação
// ============================================================

async function comConexao<T>(
  conta: ContaEmail,
  operacao: (client: ImapFlow) => Promise<T>
): Promise<T> {
  const client = new ImapFlow({
    host: conta.imap.host,
    port: conta.imap.port,
    secure: conta.imap.secure,
    auth: {
      user: conta.auth.user,
      pass: conta.auth.pass,
    },
    logger: false,
  });

  try {
    await client.connect();
    return await operacao(client);
  } finally {
    try {
      await client.logout();
    } catch {
      // ignorar erros de logout
    }
  }
}

// --- Pastas ---

export async function listarPastas(conta: ContaEmail): Promise<PastaEmail[]> {
  return comConexao(conta, async (client) => {
    const mailboxes = await client.list();
    const resultado: PastaEmail[] = [];

    for (const mb of mailboxes) {
      let messages = 0;
      let unseen = 0;
      try {
        const st = await client.status(mb.path, { messages: true, unseen: true });
        messages = st.messages ?? 0;
        unseen = st.unseen ?? 0;
      } catch {
        // algumas pastas não suportam status
      }

      resultado.push({
        nome: mb.name,
        caminho: mb.path,
        delimitador: mb.delimiter || "/",
        totalMensagens: messages,
        naoLidas: unseen,
        especialUso: (mb as any).specialUse || undefined,
      });
    }

    return resultado;
  });
}

export async function criarPasta(
  conta: ContaEmail,
  caminho: string
): Promise<void> {
  return comConexao(conta, async (client) => {
    await client.mailboxCreate(caminho);
  });
}

export async function renomearPasta(
  conta: ContaEmail,
  caminhoAtual: string,
  novoCaminho: string
): Promise<void> {
  return comConexao(conta, async (client) => {
    await client.mailboxRename(caminhoAtual, novoCaminho);
  });
}

export async function excluirPasta(
  conta: ContaEmail,
  caminho: string
): Promise<void> {
  return comConexao(conta, async (client) => {
    await client.mailboxDelete(caminho);
  });
}

// --- Emails ---

function extrairEndereco(addr: any): string {
  if (!addr) return "";
  if (typeof addr === "string") return addr;
  if (addr.address) return `${addr.name || ""} <${addr.address}>`.trim();
  if (Array.isArray(addr.value)) {
    return addr.value
      .map((v: any) => `${v.name || ""} <${v.address}>`.trim())
      .join(", ");
  }
  return String(addr);
}

export async function listarEmails(
  conta: ContaEmail,
  pasta: string,
  pagina: number,
  porPagina: number
): Promise<ResultadoPaginado<ResumoEmail>> {
  return comConexao(conta, async (client) => {
    const lock = await client.getMailboxLock(pasta);
    try {
      const mailbox = client.mailbox;
      const total = mailbox && typeof mailbox === "object" && "exists" in mailbox
        ? (mailbox as any).exists as number
        : 0;

      if (total === 0) {
        return {
          pagina,
          porPagina,
          total: 0,
          totalPaginas: 0,
          itens: [],
        };
      }

      // Calcular range (mais recentes primeiro)
      const fim = total - (pagina - 1) * porPagina;
      const inicio = Math.max(1, fim - porPagina + 1);

      if (fim < 1) {
        return {
          pagina,
          porPagina,
          total,
          totalPaginas: Math.ceil(total / porPagina),
          itens: [],
        };
      }

      const range = `${inicio}:${fim}`;
      const emails: ResumoEmail[] = [];

      for await (const msg of client.fetch(range, {
        envelope: true,
        flags: true,
        bodyStructure: true,
      })) {
        const env = msg.envelope;
        if (!env) continue;
        emails.push({
          uid: msg.uid,
          messageId: env.messageId || "",
          assunto: env.subject || "(sem assunto)",
          de: extrairEndereco(env.from?.[0]),
          para: (env.to || []).map((a: any) =>
            `${a.name || ""} <${a.address}>`.trim()
          ),
          data: env.date?.toISOString() || "",
          lido: msg.flags?.has("\\Seen") || false,
          favorito: msg.flags?.has("\\Flagged") || false,
          temAnexos: temAnexos(msg.bodyStructure),
          previa: "",
        });
      }

      // Ordenar do mais recente para o mais antigo
      emails.reverse();

      return {
        pagina,
        porPagina,
        total,
        totalPaginas: Math.ceil(total / porPagina),
        itens: emails,
      };
    } finally {
      lock.release();
    }
  });
}

function temAnexos(bodyStructure: any): boolean {
  if (!bodyStructure) return false;
  if (bodyStructure.disposition === "attachment") return true;
  if (bodyStructure.childNodes) {
    return bodyStructure.childNodes.some((c: any) => temAnexos(c));
  }
  return false;
}

export async function lerEmail(
  conta: ContaEmail,
  pasta: string,
  uid: number
): Promise<EmailCompleto> {
  return comConexao(conta, async (client) => {
    const lock = await client.getMailboxLock(pasta);
    try {
      const msg = await client.fetchOne(String(uid), { source: true, flags: true, envelope: true }, { uid: true });

      if (!msg || typeof msg === "boolean" || !msg.source) {
        throw new Error(`Email com UID ${uid} não encontrado na pasta '${pasta}'.`);
      }

      const parsed = await simpleParser(msg.source);
      const env = msg.envelope;
      if (!env) {
        throw new Error(`Não foi possível ler o envelope do email UID ${uid}.`);
      }

      const anexos: AnexoEmail[] = (parsed.attachments || []).map((att: any) => ({
        nome: att.filename || "sem-nome",
        tipo: att.contentType || "application/octet-stream",
        tamanho: att.size || 0,
        contentId: att.contentId || undefined,
      }));

      let corpoTexto = parsed.text || "";
      let corpoHtml = parsed.html || "";

      // Truncar corpos muito longos
      const LIMITE = 50000;
      if (corpoTexto.length > LIMITE) {
        corpoTexto = corpoTexto.slice(0, LIMITE) + "\n\n[... conteúdo truncado ...]";
      }
      if (typeof corpoHtml === "string" && corpoHtml.length > LIMITE) {
        corpoHtml = corpoHtml.slice(0, LIMITE) + "\n\n<!-- conteúdo truncado -->";
      }

      return {
        uid,
        messageId: env.messageId || parsed.messageId || "",
        assunto: env.subject || parsed.subject || "(sem assunto)",
        de: extrairEndereco(env.from?.[0]),
        para: (env.to || []).map((a: any) => `${a.name || ""} <${a.address}>`.trim()),
        cc: (env.cc || []).map((a: any) => `${a.name || ""} <${a.address}>`.trim()),
        bcc: (env.bcc || []).map((a: any) => `${a.name || ""} <${a.address}>`.trim()),
        data: env.date?.toISOString() || "",
        lido: msg.flags?.has("\\Seen") || false,
        favorito: msg.flags?.has("\\Flagged") || false,
        temAnexos: anexos.length > 0,
        previa: (parsed.text || "").slice(0, 200),
        corpoTexto,
        corpoHtml: typeof corpoHtml === "string" ? corpoHtml : "",
        anexos,
        referencias: parsed.references
          ? (Array.isArray(parsed.references) ? parsed.references.join(", ") : String(parsed.references))
          : "",
      };
    } finally {
      lock.release();
    }
  });
}

export async function buscarEmails(
  conta: ContaEmail,
  pasta: string,
  criterios: CriteriosBusca,
  limite: number
): Promise<ResumoEmail[]> {
  return comConexao(conta, async (client) => {
    const lock = await client.getMailboxLock(pasta);
    try {
      const query = construirBusca(criterios);
      const resultado = await client.search(query, { uid: true });

      if (!resultado || (Array.isArray(resultado) && resultado.length === 0)) return [];

      const uids = resultado as number[];
      // Pegar os mais recentes (últimos UIDs)
      const uidsSelecionados = uids.slice(-limite);
      const uidRange = uidsSelecionados.join(",");

      const emails: ResumoEmail[] = [];

      for await (const msg of client.fetch(uidRange, {
        envelope: true,
        flags: true,
        bodyStructure: true,
      }, { uid: true })) {
        const env = msg.envelope;
        if (!env) continue;
        emails.push({
          uid: msg.uid,
          messageId: env.messageId || "",
          assunto: env.subject || "(sem assunto)",
          de: extrairEndereco(env.from?.[0]),
          para: (env.to || []).map((a: any) =>
            `${a.name || ""} <${a.address}>`.trim()
          ),
          data: env.date?.toISOString() || "",
          lido: msg.flags?.has("\\Seen") || false,
          favorito: msg.flags?.has("\\Flagged") || false,
          temAnexos: temAnexos(msg.bodyStructure),
          previa: "",
        });
      }

      emails.reverse();
      return emails;
    } finally {
      lock.release();
    }
  });
}

function construirBusca(criterios: CriteriosBusca): any {
  const query: any = {};
  if (criterios.de) query.from = criterios.de;
  if (criterios.para) query.to = criterios.para;
  if (criterios.assunto) query.subject = criterios.assunto;
  if (criterios.corpo) query.body = criterios.corpo;
  if (criterios.texto) query.text = criterios.texto;
  if (criterios.desde) query.since = new Date(criterios.desde);
  if (criterios.ate) query.before = new Date(criterios.ate);
  if (criterios.lido !== undefined) query.seen = criterios.lido;
  return query;
}

// --- Organização ---

export async function moverEmail(
  conta: ContaEmail,
  pasta: string,
  uid: number,
  pastaDestino: string
): Promise<void> {
  return comConexao(conta, async (client) => {
    const lock = await client.getMailboxLock(pasta);
    try {
      await client.messageMove(String(uid), pastaDestino, { uid: true });
    } finally {
      lock.release();
    }
  });
}

export async function excluirEmail(
  conta: ContaEmail,
  pasta: string,
  uid: number,
  permanente: boolean
): Promise<void> {
  return comConexao(conta, async (client) => {
    if (permanente) {
      const lock = await client.getMailboxLock(pasta);
      try {
        await client.messageDelete(String(uid), { uid: true });
      } finally {
        lock.release();
      }
    } else {
      // Encontrar pasta lixeira
      const mailboxes = await client.list();
      const lixeira = mailboxes.find(
        (mb: any) =>
          mb.specialUse === "\\Trash" ||
          mb.path.toLowerCase() === "trash" ||
          mb.path.toLowerCase() === "lixeira" ||
          mb.path.toLowerCase() === "[gmail]/lixeira" ||
          mb.path.toLowerCase() === "[gmail]/trash"
      );

      const pastaLixeira = lixeira?.path || "Trash";

      const lock = await client.getMailboxLock(pasta);
      try {
        await client.messageMove(String(uid), pastaLixeira, { uid: true });
      } finally {
        lock.release();
      }
    }
  });
}

export async function marcarLido(
  conta: ContaEmail,
  pasta: string,
  uid: number
): Promise<void> {
  return comConexao(conta, async (client) => {
    const lock = await client.getMailboxLock(pasta);
    try {
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  });
}

export async function marcarNaoLido(
  conta: ContaEmail,
  pasta: string,
  uid: number
): Promise<void> {
  return comConexao(conta, async (client) => {
    const lock = await client.getMailboxLock(pasta);
    try {
      await client.messageFlagsRemove(String(uid), ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  });
}

export async function marcarFavorito(
  conta: ContaEmail,
  pasta: string,
  uid: number,
  favorito: boolean
): Promise<void> {
  return comConexao(conta, async (client) => {
    const lock = await client.getMailboxLock(pasta);
    try {
      if (favorito) {
        await client.messageFlagsAdd(String(uid), ["\\Flagged"], { uid: true });
      } else {
        await client.messageFlagsRemove(String(uid), ["\\Flagged"], { uid: true });
      }
    } finally {
      lock.release();
    }
  });
}
