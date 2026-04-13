import nodemailer from 'nodemailer';

let transporter;

const initializeTransporter = async () => {
  if (transporter) return transporter;

  // Check if SMTP credentials are provided
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('📧 Email Service: Using configured SMTP server.');
  } else {
    // Fallback to Ethereal for development
    console.log('⚠️ Email Service: SMTP credentials missing. Using Ethereal (Dev Mode).');
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('📧 Email Service: Ethereal Test Account created:', testAccount.user);
    } catch (err) {
      console.error('💥 Failed to create Ethereal account:', err);
    }
  }
  return transporter;
};

const sendVerificationEmail = async (to, token) => {
  if (!process.env.SMTP_HOST) {
    console.log('SMTP not configured, skipping email.');
    return;
  }

  const t = await initializeTransporter();
  if (!t) {
    console.error('💥 Email Transporter not initialized.');
    return;
  }

  const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

  const mailOptions = {
    from: '"CalangoBot" <noreply@calangobot.com>', // Sender address
    to: to, // List of receivers
    subject: 'Verifique sua conta no CalangoBot', // Subject line
    html: `
      <div style="background-color: #f4f4f4; padding: 40px; font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="background-color: #128C7E; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">CalangoBot</h1>
          </div>
          <div style="padding: 30px; text-align: center; color: #333333;">
            <h2 style="margin-top: 0; color: #128C7E;">Bem-vindo!</h2>
            <p style="font-size: 16px; line-height: 1.5; color: #555555;">
              Obrigado por se cadastrar no CalangoBot. Para começar a usar nossa plataforma e ativar sua conta, por favor confirme seu endereço de email.
            </p>
            <div style="margin: 30px 0;">
              <a href="${verificationLink}" style="background-color: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">Ativar Minha Conta</a>
            </div>
            <p style="font-size: 14px; color: #777777; margin-top: 20px;">
              Se o botão acima não funcionar, copie e cole o link abaixo no seu navegador:
            </p>
            <p style="font-size: 12px; color: #999999; word-break: break-all;">
              <a href="${verificationLink}" style="color: #128C7E;">${verificationLink}</a>
            </p>
          </div>
          <div style="background-color: #eeeeee; padding: 15px; text-align: center; font-size: 12px; color: #777777;">
            &copy; ${new Date().getFullYear()} CalangoBot. Todos os direitos reservados.
          </div>
        </div>
      </div>
    `,
  };

  try {
    const info = await t.sendMail(mailOptions);
    console.log('✅ Email sent: %s', info.messageId);

    // Preview only available when sending through an Ethereal account
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('🔍 Preview URL: %s', previewUrl);
    }

    return info;
  } catch (error) {
    console.error('💥 Error sending email:', error);
  }
};

export { sendVerificationEmail };
