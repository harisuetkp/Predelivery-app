// Spanish "platform is live" announcement template.
// Reuses the exact brand CSS used by the transactional emails in
// app/super-admin/communications/actions.ts so the look is consistent.
// Users can edit the HTML in the composer before launching — this is just
// the default starter body.

const brandPink = "#e91e8c"

const baseCss = `
  body { margin:0; padding:0; background:#f6f7f9; font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111827; }
  .wrapper { width:100%; padding:24px 12px; }
  .container { max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; overflow:hidden; }
  .brand { padding:18px 22px; border-bottom:1px solid #f1f5f9; }
  .brand-title { font-size:16px; font-weight:900; letter-spacing:0.5px; color:${brandPink}; }
  .hero { padding:40px 22px 20px; text-align:center; background:linear-gradient(180deg,#fff5fa 0%,#ffffff 100%); }
  .hero-kicker { font-size:12px; font-weight:800; letter-spacing:2px; color:${brandPink}; text-transform:uppercase; }
  .hero-title { font-size:28px; font-weight:900; margin:8px 0 0; line-height:1.15; color:#0f172a; }
  .hero-sub { margin-top:12px; font-size:15px; color:#475569; line-height:1.55; }
  .content { padding:10px 22px 22px; }
  .card { margin-top:14px; border:1px solid #e5e7eb; border-radius:12px; padding:16px; background:#ffffff; }
  .feat-title { font-weight:800; color:#0f172a; font-size:14px; }
  .feat-body { color:#475569; font-size:13px; margin-top:4px; line-height:1.5; }
  .btn { display:inline-block; margin-top:16px; background:${brandPink}; color:#ffffff !important; text-decoration:none; font-weight:800; padding:14px 22px; border-radius:12px; font-size:15px; }
  .btn-wrap { text-align:center; padding:8px 0 4px; }
  .footer { padding:16px 22px; background:#fafafa; border-top:1px solid #f1f5f9; font-size:12px; color:#64748b; text-align:center; }
  .footer a { color:#64748b; text-decoration:underline; }
  @media (max-width: 620px) {
    .wrapper { padding:16px 10px; }
    .content, .brand, .footer, .hero { padding-left:16px; padding-right:16px; }
    .hero-title { font-size:24px; }
  }
`

export const DEFAULT_LAUNCH_ANNOUNCEMENT_HTML = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>¡PR Delivery ya está aquí!</title>
    <style>${baseCss}</style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="brand">
          <div class="brand-title">PR DELIVERY</div>
        </div>

        <div class="hero">
          <div class="hero-kicker">Nueva plataforma</div>
          <h1 class="hero-title">¡Bienvenido a la nueva PR Delivery! ✨</h1>
          <p class="hero-sub">
            Después de mucho trabajo, <strong>prdelivery.com</strong> está oficialmente
            en el aire con una experiencia renovada, más rápida y hecha en Puerto Rico.
          </p>
        </div>

        <div class="content">
          <div class="card">
            <div class="feat-title">🍽️ Más restaurantes, un solo carrito</div>
            <div class="feat-body">
              Descubre restaurantes locales, pide delivery o recoge en el restaurante.
              Todo desde una misma cuenta — la misma que ya tenías con nosotros.
            </div>
          </div>

          <div class="card">
            <div class="feat-title">🎉 Catering para tus eventos</div>
            <div class="feat-body">
              ¿Cumpleaños, reunión de oficina, actividad familiar? Cotiza y ordena
              catering directo desde la plataforma, sin llamadas ni formularios.
            </div>
          </div>

          <div class="card">
            <div class="feat-title">📦 Próximamente: Subscripciones</div>
            <div class="feat-body">
              Planes de comidas semanales listos para ti. Estamos afinando los detalles —
              te avisamos tan pronto abra.
            </div>
          </div>

          <div class="btn-wrap">
            <a class="btn" href="https://prdelivery.com">Explorar PR Delivery</a>
          </div>

          <p class="feat-body" style="margin-top:18px; text-align:center;">
            Gracias por ser parte de esta historia desde el día uno. 🇵🇷
          </p>
        </div>

        <div class="footer">
          PR Delivery · <a href="https://prdelivery.com">prdelivery.com</a> · Puerto Rico<br/>
          Recibes este correo porque eres cliente de PR Delivery. Puedes ajustar tus
          preferencias de notificación desde tu cuenta.
        </div>
      </div>
    </div>
  </body>
</html>`
