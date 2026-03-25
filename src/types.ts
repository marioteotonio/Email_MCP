// ============================================================
// Tipos do Servidor MCP Universal de Email
// ============================================================

/** Configuração de servidor IMAP ou SMTP */
export interface ConfigServidor {
  host: string;
  port: number;
  secure: boolean;
}

/** Credenciais de autenticação */
export interface AuthConfig {
  user: string;
  pass: string;
}

/** Conta de email configurada */
export interface ContaEmail {
  id: string;
  nome: string;
  imap: ConfigServidor;
  smtp: ConfigServidor;
  auth: AuthConfig;
}

/** Resumo de email (para listagem) */
export interface ResumoEmail {
  uid: number;
  messageId: string;
  assunto: string;
  de: string;
  para: string[];
  data: string;
  lido: boolean;
  favorito: boolean;
  temAnexos: boolean;
  previa: string;
}

/** Email completo (para leitura) */
export interface EmailCompleto extends ResumoEmail {
  cc: string[];
  bcc: string[];
  corpoTexto: string;
  corpoHtml: string;
  anexos: AnexoEmail[];
  referencias: string;
}

/** Informação de anexo */
export interface AnexoEmail {
  nome: string;
  tipo: string;
  tamanho: number;
  contentId?: string;
}

/** Informação de pasta/mailbox */
export interface PastaEmail {
  nome: string;
  caminho: string;
  delimitador: string;
  totalMensagens: number;
  naoLidas: number;
  especialUso?: string;
}

/** Critérios de busca de emails */
export interface CriteriosBusca {
  de?: string;
  para?: string;
  assunto?: string;
  corpo?: string;
  texto?: string;
  desde?: string;
  ate?: string;
  lido?: boolean;
  comAnexos?: boolean;
}

/** Critérios de filtro */
export interface CriteriosFiltro {
  de?: string;
  para?: string;
  assunto?: string;
  contem?: string;
  naoContem?: string;
}

/** Ação do filtro */
export interface AcaoFiltro {
  moverPara?: string;
  marcarLido?: boolean;
  marcarFavorito?: boolean;
  excluir?: boolean;
}

/** Filtro de email */
export interface FiltroEmail {
  id: string;
  contaId: string;
  nome: string;
  criterios: CriteriosFiltro;
  acao: AcaoFiltro;
  ativo: boolean;
}

/** Opções para envio de email */
export interface OpcoesEnvio {
  de?: string;
  para: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  assunto: string;
  corpo: string;
  html?: string;
  responderA?: string;
  referencias?: string;
}

/** Resultado paginado */
export interface ResultadoPaginado<T> {
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
  itens: T[];
}

/** Configuração completa do servidor */
export interface ConfiguracaoServidor {
  contas: ContaEmail[];
  filtros: FiltroEmail[];
}
