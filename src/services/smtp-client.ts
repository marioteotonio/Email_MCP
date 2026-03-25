import nodemailer from "nodemailer";
import type { ContaEmail, OpcoesEnvio } from "../types.js";

// ============================================================
// Wrapper Nodemailer — envio de emails via SMTP
// ============================================================

export async function enviarEmail(
  conta: ContaEmail,
  opcoes: OpcoesEnvio
): Promise<string> {
  const transporter = nodemailer.createTransport({
    host: conta.smtp.host,
    port: conta.smtp.port,
    secure: conta.smtp.secure,
    auth: {
      user: conta.auth.user,
      pass: conta.auth.pass,
    },
  });

  const info = await transporter.sendMail({
    from: opcoes.de || conta.auth.user,
    to: opcoes.para,
    cc: opcoes.cc,
    bcc: opcoes.bcc,
    subject: opcoes.assunto,
    text: opcoes.corpo,
    html: opcoes.html,
    inReplyTo: opcoes.responderA,
    references: opcoes.referencias,
  });

  return info.messageId;
}
