interface Env {
  CERT_IMAGES: R2Bucket;
}

const SITE_ORIGIN = "https://certification.datagibberish.com";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const certId = context.params.certId as string;
  const shareUrl = `${SITE_ORIGIN}/share/${encodeURIComponent(certId)}`;
  const certUrl = SITE_ORIGIN;

  const jsonObject = await context.env.CERT_IMAGES.get(`certs/${certId}.json`);
  if (!jsonObject) {
    return Response.redirect(certUrl, 302);
  }

  const meta = await jsonObject.json<{ name: string; specialization: string; date: string }>();
  const name = meta.name || "A Data Professional";
  const spec = meta.specialization || "";
  const date = meta.date || "";

  const description = spec
    ? `${name} is now certified in ${spec}. Get your own free certification.`
    : `${name} is now a Licensed AI-Powered Insights Leverage Specialist™. Get your own free certification.`;

  const linkedInSpec = spec.replace(/&/g, "and");
  const linkedInText = `I am thrilled to share that I have officially earned my certification as a Licensed AI-Powered Insights Leverage Specialist from the Data Gibberish Institute for Enterprise Excellence.\n\nAfter an incredibly rigorous examination process, I am now fully authorized to Drive Scalable, Enterprise-Grade, Value-Aligned Data Outcomes across cross-functional teams and AI-powered ecosystems.\n\nMy area of specialization: ${linkedInSpec}\n\nThis journey has been nothing short of transformative. I want to thank my stakeholders, my synergy partners, and everyone who believed in my ability to leverage insights at scale.\n\nKey takeaways from this experience:\n- Alignment is not a destination, it is a mindset\n- Every pipeline is a journey\n- The real data was the friends we made along the way\n\nTo anyone considering this path -- you deserve to invest in yourself. Get certified for free.\n\n#DataGibberish #Certified #ThoughtLeadership #AI #DataDriven #Synergy #LeverageAtScale #EnterpriseExcellence #TransformativeOutcomes`;
  const linkedInUrl = `https://www.linkedin.com/shareArticle?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(linkedInText)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta property="og:title" content="${esc(name)} — Licensed AI-Powered Insights Leverage Specialist™">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(shareUrl)}">
  <meta name="twitter:card" content="summary">
  <title>${esc(name)} — Certified Data Gibberish Specialist</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --c1: #1e2939; --c2: #6a7282; --c3: #94a3b8; --c4: #cbd5e1; --c5: #f1f5f9;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', sans-serif; background: var(--c1); color: #fff; min-height: 100vh; padding: 40px 20px 60px; }
    .wrapper { max-width: 800px; margin: 0 auto; }
    .congrats { text-align: center; margin-bottom: 32px; }
    .congrats h2 { font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: 1px; margin-bottom: 4px; }
    .congrats p { color: var(--c3); font-size: 14px; }
    .cert {
      position: relative; background: #ffffff; border: 2px solid var(--c1);
      padding: 48px 56px; text-align: center; color: var(--c1);
      box-shadow: 0 1px 0 0 var(--c4), 0 24px 60px rgba(0,0,0,0.25);
    }
    .cert-rule-top, .cert-rule-bottom { position: absolute; left: 20px; right: 20px; height: 1px; background: var(--c4); }
    .cert-rule-top { top: 16px; }
    .cert-rule-bottom { bottom: 16px; }
    .cert-top-line { font-size: 10px; letter-spacing: 4px; text-transform: uppercase; color: var(--c2); margin-bottom: 24px; font-weight: 600; }
    .cert-seal { width: 64px; height: 64px; margin: 0 auto 24px; }
    .cert-seal svg { width: 100%; height: 100%; }
    .cert-title-pre { font-size: 14px; color: var(--c2); margin-bottom: 4px; }
    .cert-awarded-to { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: var(--c3); margin-bottom: 6px; }
    .cert-name { font-size: 36px; font-weight: 700; color: var(--c1); margin-bottom: 20px; letter-spacing: -0.5px; }
    .cert-divider { width: 60px; height: 2px; background: var(--c1); margin: 0 auto 20px; }
    .cert-title { font-size: 26px; font-weight: 700; color: var(--c1); line-height: 1.25; margin-bottom: 20px; letter-spacing: -0.3px; }
    .cert-body { font-size: 15px; line-height: 1.7; color: var(--c2); max-width: 520px; margin: 0 auto 24px; }
    .cert-spec { display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px 24px; margin-bottom: 24px; }
    .cert-spec-label { font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; color: #6a7282; margin-bottom: 4px; font-weight: 600; }
    .cert-spec-value { font-size: 15px; color: #1e2939; font-weight: 600; }
    .cert-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 28px; padding-top: 18px; border-top: 1px solid var(--c4); }
    .cert-footer-col { text-align: center; flex: 1; }
    .cert-footer-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--c3); margin-bottom: 3px; font-weight: 600; }
    .cert-footer-value { font-size: 13px; color: var(--c2); font-weight: 500; }
    .cert-issuer { font-size: 9px; letter-spacing: 1px; color: var(--c3); margin-top: 20px; line-height: 1.6; }
    .actions { text-align: center; margin-top: 32px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
    .btn-subscribe { display: inline-block; background: #2563eb; color: #ffffff; padding: 16px 48px; font-size: 17px; font-weight: 700; border-radius: 8px; text-decoration: none; transition: background 0.2s, transform 0.2s; font-family: 'DM Sans', sans-serif; }
    .btn-subscribe:hover { background: #1d4ed8; transform: translateY(-1px); }
    .subscribe-hint { color: var(--c4); font-size: 14px; margin-top: 8px; }
    .secondary-actions { display: flex; gap: 16px; margin-top: 32px; padding-top: 28px; border-top: 1px solid #364152; }
    .btn-linkedin { display: inline-flex; align-items: center; gap: 8px; background: none; border: 1.5px solid var(--c3); color: #ffffff; padding: 12px 24px; font-size: 14px; font-weight: 600; border-radius: 8px; transition: all 0.2s ease; font-family: 'DM Sans', sans-serif; text-decoration: none; }
    .btn-linkedin:hover { border-color: #ffffff; }
    .btn-get-cert { display: inline-flex; align-items: center; gap: 8px; background: none; border: 1.5px solid var(--c3); color: #ffffff; padding: 12px 24px; font-size: 14px; font-weight: 600; border-radius: 8px; transition: all 0.2s ease; font-family: 'DM Sans', sans-serif; text-decoration: none; }
    .btn-get-cert:hover { border-color: #ffffff; }
    @media (max-width: 640px) {
      .cert { padding: 32px 20px; }
      .cert-title { font-size: 21px; }
      .cert-name { font-size: 28px; }
      .cert-footer { flex-direction: column; gap: 14px; align-items: center; }
      .cert-rule-top, .cert-rule-bottom { left: 12px; right: 12px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="congrats">
      <h2>EXAMINATION PASSED</h2>
      <p>This certificate has been officially issued. Congratulations on this meaningless achievement.</p>
    </div>

    <div class="cert">
      <div class="cert-rule-top"></div>
      <div class="cert-rule-bottom"></div>
      <div class="cert-top-line">Certificate of Enterprise Excellence</div>
      <div class="cert-seal">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#1e2939" stroke-width="2"/>
          <circle cx="50" cy="50" r="38" fill="none" stroke="#94a3b8" stroke-width="0.5"/>
          <text x="50" y="38" text-anchor="middle" font-family="'DM Sans', sans-serif" font-size="6" font-weight="700" fill="#1e2939" letter-spacing="0.5">DATA</text>
          <text x="50" y="48" text-anchor="middle" font-family="'DM Sans', sans-serif" font-size="6" font-weight="700" fill="#1e2939" letter-spacing="0.5">GIBBERISH</text>
          <text x="50" y="60" text-anchor="middle" font-family="'DM Sans', sans-serif" font-size="5" font-weight="600" fill="#6a7282" letter-spacing="1.5">CERTIFIED</text>
        </svg>
      </div>
      <div class="cert-title-pre">This is to certify that</div>
      <div class="cert-awarded-to">THE FOLLOWING INDIVIDUAL</div>
      <div class="cert-name">${esc(name)}</div>
      <div class="cert-divider"></div>
      <div class="cert-title">Licensed AI-Powered Insights<br>Leverage Specialist&#8482;</div>
      <div class="cert-body">
        has demonstrated exceptional proficiency in Leveraging Cross-Functional
        Synergies Across the Modern AI-Powered Data Stack and is hereby authorized
        to Drive Scalable, Enterprise-Grade, Value-Aligned Data Outcomes in any
        organization that has no idea what any of this means.
      </div>
      ${spec ? `<div class="cert-spec">
        <div class="cert-spec-label">Area of Specialization</div>
        <div class="cert-spec-value">${esc(spec)}</div>
      </div>` : ""}
      <div class="cert-footer">
        <div class="cert-footer-col">
          <div class="cert-footer-label">Date of Issue</div>
          <div class="cert-footer-value">${esc(date)}</div>
        </div>
        <div class="cert-footer-col">
          <div class="cert-footer-label">Certificate ID</div>
          <div class="cert-footer-value">${esc(certId)}</div>
        </div>
        <div class="cert-footer-col">
          <div class="cert-footer-label">Valid Until</div>
          <div class="cert-footer-value">The Next Reorg</div>
        </div>
      </div>
      <div class="cert-issuer">
        Issued by The Data Gibberish Institute for Enterprise Excellence<br>
        &amp; Advanced AI-Driven Thought Leadership&#8482;<br>
        datagibberish.com
      </div>
    </div>

    <div class="actions">
      <a class="btn-subscribe" href="https://www.datagibberish.com/" target="_blank">Subscribe to Data Gibberish &rarr;</a>
      <p class="subscribe-hint">Want to actually get good at your data career?</p>
      <div class="secondary-actions">
        <a class="btn-linkedin" href="${esc(linkedInUrl)}" target="_blank">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          Share on LinkedIn
        </a>
        <a class="btn-get-cert" href="${certUrl}">Get Your Free Certificate &rarr;</a>
      </div>
    </div>
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
