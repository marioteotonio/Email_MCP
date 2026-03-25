import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConfigService } from "./services/config.js";
import { registrarFerramentasContas } from "./tools/contas.js";
import { registrarFerramentasPastas } from "./tools/pastas.js";
import { registrarFerramentasEmails } from "./tools/emails.js";
import { registrarFerramentasEnviar } from "./tools/enviar.js";
import { registrarFerramentasOrganizar } from "./tools/organizar.js";
import { registrarFerramentasFiltros } from "./tools/filtros.js";

export function criarServidor(): McpServer {
  const server = new McpServer({
    name: "email-mcp-server",
    version: "1.0.0",
  });

  const config = new ConfigService();

  // Registrar todas as 21 ferramentas
  registrarFerramentasContas(server, config);
  registrarFerramentasPastas(server, config);
  registrarFerramentasEmails(server, config);
  registrarFerramentasEnviar(server, config);
  registrarFerramentasOrganizar(server, config);
  registrarFerramentasFiltros(server, config);

  return server;
}
