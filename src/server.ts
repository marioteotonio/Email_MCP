import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConfigService } from "./services/config.js";
import { registrarFerramentasContas } from "./tools/contas.js";
import { registrarFerramentasPastas } from "./tools/pastas.js";
import { registrarFerramentasEmails } from "./tools/emails.js";
import { registrarFerramentasEnviar } from "./tools/enviar.js";
import { registrarFerramentasOrganizar } from "./tools/organizar.js";
import { registrarFerramentasFiltros } from "./tools/filtros.js";

export async function criarServidor(): Promise<McpServer> {
  const server = new McpServer({
    name: "email-mcp-server",
    version: "1.0.0",
  });

  const config = await ConfigService.create();

  // Registrar todas as ferramentas
  registrarFerramentasContas(server, config);
  registrarFerramentasPastas(server, config);
  registrarFerramentasEmails(server, config);
  registrarFerramentasEnviar(server, config);
  registrarFerramentasOrganizar(server, config);
  registrarFerramentasFiltros(server, config);

  return server;
}
