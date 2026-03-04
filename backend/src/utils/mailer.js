const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // App Password de Gmail, no la contraseña real
  },
});

const sendPasswordReset = async ({ to, name, tempPassword }) => {
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
        <tr><td align="center">
          <table width="100%" style="max-width:520px;background:#111118;border-radius:20px;border:1px solid #2e2e3e;overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="background:#7c3aed;padding:28px 32px;text-align:center;">
                <div style="display:inline-block;width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:14px;line-height:48px;font-size:24px;font-weight:900;color:white;margin-bottom:12px;">F</div>
                <h1 style="margin:0;color:white;font-size:22px;font-weight:700;letter-spacing:-0.5px;">FinTrack</h1>
                <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Recuperación de contraseña</p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                <p style="color:#94a3b8;font-size:14px;margin:0 0 8px;">Hola, <strong style="color:#e2e8f0;">${name}</strong></p>
                <p style="color:#64748b;font-size:14px;margin:0 0 24px;line-height:1.6;">
                  Recibimos una solicitud para restablecer tu contraseña. Tu contraseña temporal es:
                </p>

                <!-- Password box -->
                <div style="background:#1a1a24;border:1px solid #3d3d52;border-radius:14px;padding:20px;text-align:center;margin-bottom:24px;">
                  <p style="margin:0 0 6px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Contraseña temporal</p>
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:26px;font-weight:700;color:#a78bfa;letter-spacing:4px;">${tempPassword}</p>
                </div>

                <!-- Warning -->
                <div style="background:#f59e0b18;border:1px solid #f59e0b33;border-radius:12px;padding:14px 16px;margin-bottom:24px;">
                  <p style="margin:0;color:#fbbf24;font-size:13px;line-height:1.5;">
                    ⚠️ <strong>Importante:</strong> Una vez que ingreses con esta contraseña temporal, andate a
                    <strong>Configuración de cuenta</strong> y cambiala por una nueva.
                  </p>
                </div>

                <p style="color:#64748b;font-size:12px;margin:0;line-height:1.6;">
                  Si no solicitaste este cambio, ignorá este email. Tu contraseña anterior ya no es válida.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #1a1a24;">
                <p style="margin:0;color:#3d3d52;font-size:11px;text-align:center;">
                  FinTrack · Este es un email automático, no respondas este mensaje.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"FinTrack" <${process.env.MAIL_USER}>`,
    to,
    subject: '🔑 Tu contraseña temporal — FinTrack',
    html,
  });
};

module.exports = { sendPasswordReset };
