interface Env {
  CERT_IMAGES: R2Bucket;
}

const SITE_ORIGIN = "https://certification.datagibberish.com";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const certId = context.params.certId as string;
  const imageUrl = `${SITE_ORIGIN}/api/cert-image/${encodeURIComponent(certId)}`;
  const shareUrl = `${SITE_ORIGIN}/share/${encodeURIComponent(certId)}`;
  const certUrl = SITE_ORIGIN;

  const object = await context.env.CERT_IMAGES.head(`certs/${certId}.png`);

  if (!object) {
    return Response.redirect(certUrl, 302);
  }

  const name = object.customMetadata?.name || "A Data Professional";
  const spec = object.customMetadata?.specialization || "";

  const description = spec
    ? `${name} is now certified in ${spec}. Get your own free certification.`
    : `${name} is now a Licensed AI-Powered Insights Leverage Specialist™. Get your own free certification.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta property="og:title" content="${esc(name)} — Licensed AI-Powered Insights Leverage Specialist™">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(imageUrl)}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1600">
  <meta property="og:image:height" content="900">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(shareUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <title>${esc(name)} — Certified Data Gibberish Specialist</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', sans-serif; background: #1e2939; color: #fff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; }
    .card { max-width: 720px; width: 100%; text-align: center; }
    .badge { display: inline-block; background: rgba(255,255,255,0.08); color: #94a3b8; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 16px; border-radius: 100px; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; }
    .subtitle { color: #6a7282; font-size: 14px; margin-bottom: 32px; }
    .cert-img { width: 100%; border-radius: 4px; box-shadow: 0 24px 60px rgba(0,0,0,0.35); margin-bottom: 36px; }
    .cta { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 16px 40px; font-size: 16px; font-weight: 700; border-radius: 8px; transition: background 0.2s, transform 0.2s; font-family: 'DM Sans', sans-serif; }
    .cta:hover { background: #1d4ed8; transform: translateY(-1px); }
    .footer { color: #4b5563; font-size: 12px; margin-top: 24px; }
    .footer a { color: #6a7282; text-decoration: none; }
    .footer a:hover { color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Officially Certified</div>
    <h1>${esc(name)}</h1>
    <p class="subtitle">Licensed AI-Powered Insights Leverage Specialist™${spec ? `<br>Specializing in ${esc(spec)}` : ""}</p>
    <img class="cert-img" src="${esc(imageUrl)}" alt="Certificate for ${esc(name)}">
    <a class="cta" href="${certUrl}">Get Your Free Certificate &rarr;</a>
    <p class="footer">Issued by <a href="https://www.datagibberish.com/">The Data Gibberish Institute</a> for Enterprise Excellence</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html;charset=UTF-8" },
  });
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
