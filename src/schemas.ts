import { z } from "zod";

// ============================================================
// Schemas Zod — Todos em Português Brasil
// ============================================================

// --- Schemas base reutilizáveis ---

export const schemaContaId = z.object({
  contaId: z.string().describe("ID da conta de email (ex: 'gmail-pessoal')"),
}).strict();

export const schemaContaPasta = z.object({
  contaId: z.string().describe("ID da conta de email"),
  pasta: z.string().default("INBOX").describe("Caminho da pasta (ex: 'INBOX', 'Sent', 'Drafts')"),
}).strict();

export const schemaContaPastaUid = z.object({
  contaId: z.string().describe("ID da conta de email"),
  pasta: z.string().default("INBOX").describe("Caminho da pasta"),
  uid: z.number().int().positive().describe("UID único do email na pasta"),
}).strict();

// --- Contas ---

export const schemaAdicionarConta = z.object({
  id: z.string().min(1).max(50).describe("ID único da conta (ex: 'gmail-trabalho')"),
  nome: z.string().min(1).max(100).describe("Nome descritivo da conta (ex: 'Gmail Trabalho')"),
  imapHost: z.string().describe("Servidor IMAP (ex: 'imap.gmail.com')"),
  imapPort: z.number().int().default(993).describe("Porta IMAP (padrão: 993)"),
  imapSecure: z.boolean().default(true).describe("Usar SSL/TLS no IMAP (padrão: true)"),
  smtpHost: z.string().describe("Servidor SMTP (ex: 'smtp.gmail.com')"),
  smtpPort: z.number().int().default(587).describe("Porta SMTP (padrão: 587)"),
  smtpSecure: z.boolean().default(false).describe("Usar SSL implícito no SMTP (padrão: false, usa STARTTLS)"),
  usuario: z.string().describe("Endereço de email / usuário"),
  senha: z.string().describe("Senha ou App Password"),
}).strict();

export const schemaAdicionarContaRapida = z.object({
  provedor: z.enum(["gmail", "outlook", "hotmail", "locaweb", "yahoo", "icloud", "zoho"]).describe("Provedor de email (gmail, outlook, hotmail, locaweb, yahoo, icloud, zoho)"),
  usuario: z.string().describe("Endereço de email completo (ex: 'mario@gmail.com')"),
  senha: z.string().describe("Senha ou App Password"),
  id: z.string().optional().describe("ID personalizado (opcional — gerado automaticamente se omitido)"),
  nome: z.string().optional().describe("Nome descritivo (opcional — gerado automaticamente se omitido)"),
}).strict();

export const schemaRemoverConta = z.object({
  contaId: z.string().describe("ID da conta a remover"),
  confirmar: z.boolean().describe("Confirmação de remoção (deve ser true)"),
}).strict();

// --- Pastas ---

export const schemaCriarPasta = z.object({
  contaId: z.string().describe("ID da conta de email"),
  caminho: z.string().min(1).describe("Caminho da nova pasta (ex: 'Projetos/ClienteX')"),
}).strict();

export const schemaRenomearPasta = z.object({
  contaId: z.string().describe("ID da conta de email"),
  caminhoAtual: z.string().describe("Caminho atual da pasta"),
  novoCaminho: z.string().describe("Novo caminho/nome da pasta"),
}).strict();

export const schemaExcluirPasta = z.object({
  contaId: z.string().describe("ID da conta de email"),
  caminho: z.string().describe("Caminho da pasta a excluir"),
  confirmar: z.boolean().describe("Confirmação de exclusão (deve ser true)"),
}).strict();

// --- Emails ---

export const schemaListarEmails = z.object({
  contaId: z.string().describe("ID da conta de email"),
  pasta: z.string().default("INBOX").describe("Pasta para listar (padrão: 'INBOX')"),
  pagina: z.number().int().min(1).default(1).describe("Número da página (padrão: 1)"),
  porPagina: z.number().int().min(1).max(100).default(20).describe("Emails por página (padrão: 20, máx: 100)"),
}).strict();

export const schemaBuscarEmails = z.object({
  contaId: z.string().describe("ID da conta de email"),
  pasta: z.string().default("INBOX").describe("Pasta onde buscar (padrão: 'INBOX')"),
  de: z.string().optional().describe("Filtrar por remetente"),
  para: z.string().optional().describe("Filtrar por destinatário"),
  assunto: z.string().optional().describe("Buscar no assunto"),
  corpo: z.string().optional().describe("Buscar no corpo do email"),
  texto: z.string().optional().describe("Buscar em qualquer parte (assunto, corpo, remetente)"),
  desde: z.string().optional().describe("Data inicial (formato: YYYY-MM-DD)"),
  ate: z.string().optional().describe("Data final (formato: YYYY-MM-DD)"),
  lido: z.boolean().optional().describe("Filtrar por status de leitura"),
  limite: z.number().int().min(1).max(200).default(50).describe("Máximo de resultados (padrão: 50)"),
}).strict();

// --- Enviar ---

export const schemaEnviarEmail = z.object({
  contaId: z.string().describe("ID da conta de email remetente"),
  para: z.union([z.string(), z.array(z.string())]).describe("Destinatário(s) — email ou lista de emails"),
  cc: z.union([z.string(), z.array(z.string())]).optional().describe("Cópia (CC) — email ou lista"),
  bcc: z.union([z.string(), z.array(z.string())]).optional().describe("Cópia oculta (BCC) — email ou lista"),
  assunto: z.string().describe("Assunto do email"),
  corpo: z.string().describe("Corpo do email em texto puro"),
  html: z.string().optional().describe("Corpo do email em HTML (opcional)"),
}).strict();

export const schemaResponderEmail = z.object({
  contaId: z.string().describe("ID da conta de email"),
  pasta: z.string().default("INBOX").describe("Pasta onde está o email original"),
  uid: z.number().int().positive().describe("UID do email a responder"),
  corpo: z.string().describe("Corpo da resposta em texto puro"),
  html: z.string().optional().describe("Corpo da resposta em HTML (opcional)"),
  responderTodos: z.boolean().default(false).describe("Responder a todos (true) ou só ao remetente (false)"),
}).strict();

export const schemaEncaminharEmail = z.object({
  contaId: z.string().describe("ID da conta de email"),
  pasta: z.string().default("INBOX").describe("Pasta onde está o email original"),
  uid: z.number().int().positive().describe("UID do email a encaminhar"),
  para: z.union([z.string(), z.array(z.string())]).describe("Destinatário(s) do encaminhamento"),
  corpo: z.string().default("").describe("Mensagem adicional (opcional)"),
}).strict();

// --- Organizar ---

export const schemaMoverEmail = z.object({
  contaId: z.string().describe("ID da conta de email"),
  pasta: z.string().describe("Pasta atual do email"),
  uid: z.number().int().positive().describe("UID do email a mover"),
  pastaDestino: z.string().describe("Pasta de destino"),
}).strict();

export const schemaExcluirEmail = z.object({
  contaId: z.string().describe("ID da conta de email"),
  pasta: z.string().describe("Pasta atual do email"),
  uid: z.number().int().positive().describe("UID do email a excluir"),
  permanente: z.boolean().default(false).describe("Excluir permanentemente (true) ou mover para lixeira (false)"),
}).strict();

export const schemaMarcarFavorito = z.object({
  contaId: z.string().describe("ID da conta de email"),
  pasta: z.string().default("INBOX").describe("Pasta do email"),
  uid: z.number().int().positive().describe("UID do email"),
  favorito: z.boolean().default(true).describe("true para marcar, false para desmarcar"),
}).strict();

// --- Filtros ---

export const schemaCriarFiltro = z.object({
  contaId: z.string().describe("ID da conta de email"),
  nome: z.string().min(1).describe("Nome descritivo do filtro"),
  criterios: z.object({
    de: z.string().optional().describe("Filtrar por remetente"),
    para: z.string().optional().describe("Filtrar por destinatário"),
    assunto: z.string().optional().describe("Filtrar por assunto (contém)"),
    contem: z.string().optional().describe("Corpo contém texto"),
    naoContem: z.string().optional().describe("Corpo não contém texto"),
  }).strict().describe("Critérios de correspondência do filtro"),
  acao: z.object({
    moverPara: z.string().optional().describe("Mover para esta pasta"),
    marcarLido: z.boolean().optional().describe("Marcar como lido automaticamente"),
    marcarFavorito: z.boolean().optional().describe("Marcar como favorito"),
    excluir: z.boolean().optional().describe("Excluir automaticamente"),
  }).strict().describe("Ação a executar quando o filtro corresponder"),
}).strict();

export const schemaExcluirFiltro = z.object({
  filtroId: z.string().describe("ID do filtro a excluir"),
  confirmar: z.boolean().describe("Confirmação de exclusão (deve ser true)"),
}).strict();

export const schemaListarFiltros = z.object({
  contaId: z.string().optional().describe("Filtrar por conta específica (opcional, lista todos se omitido)"),
}).strict();
