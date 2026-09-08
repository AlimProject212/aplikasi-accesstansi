import nodemailer from 'nodemailer';

// ─── Transporter ──────────────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== 'false', // true untuk port 465
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  });
}

// ─── HTML Email Template ───────────────────────────────────────────────────────
function buildWelcomeEmail(data: {
  companyName: string;
  companyCode: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
  loginUrl: string;
}): string {
  const { companyName, companyCode, ownerName, ownerEmail, password, loginUrl } = data;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Selamat Datang di AccessTansi</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0d0d0d;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d0d;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">

          <!-- Header Band -->
          <tr>
            <td style="background:linear-gradient(135deg,#7a1b1e 0%,#c0392b 50%,#7a1b1e 100%);padding:32px 40px;text-align:center;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <!-- Logo pill -->
                    <div style="display:inline-block;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.15);
                                border-radius:12px;padding:8px 22px;margin-bottom:16px;">
                      <span style="font-size:18px;font-weight:800;color:#fff;letter-spacing:.5px;">
                        Access<span style="color:#f4b8b8;">Tansi</span>
                      </span>
                    </div>
                    <br/>
                    <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-.3px;">
                      Selamat Datang! 🎉
                    </span>
                    <br/>
                    <span style="font-size:13px;color:rgba(255,255,255,.7);margin-top:6px;display:block;">
                      Akun AccessTansi Anda telah berhasil dibuat
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">

              <!-- Greeting -->
              <p style="margin:0 0 24px;font-size:15px;color:#d4d4d4;line-height:1.6;">
                Halo <strong style="color:#fff;">${ownerName}</strong>,<br/>
                Registrasi perusahaan <strong style="color:#fff;">${companyName}</strong> telah berhasil.
                Berikut adalah informasi akun Anda — <span style="color:#f87171;">harap simpan dengan aman.</span>
              </p>

              <!-- Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#111;border:1px solid #2e2e2e;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:24px 28px;">

                    <!-- Company ID (highlighted) -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"
                           style="background:linear-gradient(135deg,rgba(122,27,30,.3),rgba(192,57,43,.15));
                                  border:1px solid rgba(192,57,43,.4);border-radius:10px;margin-bottom:16px;">
                      <tr>
                        <td style="padding:16px 20px;">
                          <span style="font-size:11px;font-weight:600;color:#f87171;letter-spacing:1px;
                                       text-transform:uppercase;display:block;margin-bottom:6px;">
                            Company ID (Digunakan Saat Login)
                          </span>
                          <span style="font-size:26px;font-weight:800;color:#fff;letter-spacing:3px;
                                       font-family:'Courier New',monospace;">
                            ${companyCode}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- Credential rows -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <!-- Email -->
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #2a2a2a;">
                          <span style="font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:.8px;
                                       text-transform:uppercase;display:block;margin-bottom:2px;">Email Login</span>
                          <span style="font-size:14px;color:#e5e7eb;font-family:'Courier New',monospace;">${ownerEmail}</span>
                        </td>
                      </tr>
                      <!-- Password -->
                      <tr>
                        <td style="padding:10px 0;">
                          <span style="font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:.8px;
                                       text-transform:uppercase;display:block;margin-bottom:2px;">Password</span>
                          <span style="font-size:14px;color:#e5e7eb;font-family:'Courier New',monospace;">${password}</span>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#c0392b,#9b2335);
                              color:#fff;font-size:15px;font-weight:700;text-decoration:none;
                              padding:14px 40px;border-radius:10px;letter-spacing:.3px;">
                      Masuk ke AccessTansi →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(251,191,36,.07);border:1px solid rgba(251,191,36,.2);
                            border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <span style="font-size:12px;color:#fbbf24;font-weight:600;display:block;margin-bottom:4px;">
                      ⚠️ Penting — Keamanan Akun
                    </span>
                    <span style="font-size:12px;color:#d4d4d4;line-height:1.6;">
                      Email ini berisi informasi sensitif. Jangan teruskan ke pihak lain.
                      Segera <strong style="color:#fbbf24;">ganti password</strong> setelah login pertama kali
                      melalui menu <em>Pengaturan → Ubah Password</em>.
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #2a2a2a;margin:0 0 20px;" />

              <!-- Footer note -->
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;text-align:center;">
                Email ini dikirim otomatis oleh sistem AccessTansi.<br/>
                Jika Anda tidak melakukan pendaftaran ini, abaikan email ini.<br/>
                <a href="https://accesstansi.id" style="color:#f87171;text-decoration:none;">accesstansi.id</a>
                &nbsp;·&nbsp;
                <a href="https://wa.me/6281932888305" style="color:#f87171;text-decoration:none;">Hubungi Support</a>
              </p>

            </td>
          </tr>

          <!-- Footer Band -->
          <tr>
            <td style="background:#111;padding:16px 40px;text-align:center;border-top:1px solid #222;">
              <span style="font-size:11px;color:#4b5563;">
                © ${new Date().getFullYear()} AccessTansi · Semua hak dilindungi
              </span>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Email Service ─────────────────────────────────────────────────────────────
export const emailService = {

  async sendWelcomeEmail(params: {
    companyName: string;
    companyCode: string;
    ownerName: string;
    ownerEmail: string;
    password: string;
  }): Promise<void> {
    // Jika SMTP_USER tidak dikonfigurasi, skip (tidak error)
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('[Email] SMTP_USER/SMTP_PASS belum dikonfigurasi — email welcome tidak dikirim.');
      return;
    }

    const loginUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL}/login`
      : 'https://app.accesstansi.id/login';

    const html = buildWelcomeEmail({ ...params, loginUrl });

    const transporter = createTransporter();

    const fromName = process.env.SMTP_FROM_NAME || 'AccessTansi';
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '';

    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: params.ownerEmail,
        subject: `[AccessTansi] Selamat datang, ${params.ownerName}! Ini info akun Anda`,
        html,
      });
      console.log(`[Email] Welcome email terkirim ke ${params.ownerEmail} — messageId: ${info.messageId}`);
    } catch (err) {
      // Jangan gagalkan registrasi hanya karena email error
      console.error('[Email] Gagal mengirim welcome email:', err);
    }
  },
};
