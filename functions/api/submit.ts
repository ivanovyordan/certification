import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
// @ts-ignore — wrangler bundles .wasm imports
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import satori from "satori";

interface Env {
  SENDFOX_API_KEY: string;
  SENDFOX_LIST_ID: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  CERT_IMAGES: R2Bucket;
  ASSETS: Fetcher;
}

interface CertRequest {
  name: string;
  email: string;
  specialization: string;
  certId: string;
  date: string;
}

/* ── wasm + font singleton ─────────────────────────────── */

let wasmReady: Promise<void> | null = null;

function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(resvgWasm);
  }
  return wasmReady;
}

let fontCache: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

async function loadFonts(assets: Fetcher): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
  if (fontCache) return fontCache;
  const [regular, bold] = await Promise.all([
    assets.fetch(new URL('/fonts/dm-sans-400.ttf', 'https://placeholder')).then(r => r.arrayBuffer()),
    assets.fetch(new URL('/fonts/dm-sans-700.ttf', 'https://placeholder')).then(r => r.arrayBuffer()),
  ]);
  fontCache = { regular, bold };
  return fontCache;
}

/* ── handler ───────────────────────────────────────────── */

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const body = (await context.request.json()) as CertRequest;
    const { name, email, specialization, certId, date } = body;

    if (!name || !email || !specialization || !certId || !date) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: corsHeaders },
      );
    }

    // Initialise wasm (no-op after the first call in this isolate)
    await ensureWasm();

    // Run SendFox, PDF, and PNG generation in parallel
    const sendFoxPromise = addToSendFox(context.env, email, name).catch(
      (err) => console.error("SendFox error:", err),
    );

    const pdfPromise = generateCertificatePDF(name, specialization, certId, date);
    const pngPromise = generateCertificateImage(name, specialization, certId, date, context.env.ASSETS);

    const [, pdfBytes, pngBytes] = await Promise.all([
      sendFoxPromise,
      pdfPromise,
      pngPromise,
    ]);

    // Upload PNG to R2
    const shareUrl = `https://certification.datagibberish.com/share/${certId}`;
    await context.env.CERT_IMAGES.put(`certs/${certId}.png`, pngBytes, {
      httpMetadata: { contentType: "image/png" },
      customMetadata: { name, specialization },
    });

    // Send certificate email with PDF
    await sendCertificateEmail(context.env, email, name, certId, pdfBytes);

    return new Response(JSON.stringify({ success: true, shareUrl }), {
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("Submit error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to process certification",
      }),
      { status: 500, headers: corsHeaders },
    );
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};

/* ── PNG generation (Satori → resvg) ─────────────────── */

function certificateLayout(
  name: string,
  specialization: string,
  certId: string,
  date: string,
): any {
  const nameSize = name.length > 24 ? 42 : 52;

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        background: 'white',
        padding: '28px 56px',
        fontFamily: 'DM Sans',
      },
      children: [
        // Outer border
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              height: '100%',
              border: '1px solid #cbd5e1',
              padding: '20px 40px',
            },
            children: [
              // Top line
              {
                type: 'div',
                props: {
                  style: { fontSize: 14, fontWeight: 700, color: '#6a7282', letterSpacing: 4, marginTop: 8 },
                  children: 'CERTIFICATE OF ENTERPRISE EXCELLENCE',
                },
              },
              // Seal
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    border: '2px solid #1e2939',
                    marginTop: 12,
                  },
                  children: [
                    { type: 'div', props: { style: { fontSize: 13, fontWeight: 700, color: '#1e2939', letterSpacing: 0.5 }, children: 'DATA' } },
                    { type: 'div', props: { style: { fontSize: 13, fontWeight: 700, color: '#1e2939', letterSpacing: 0.5 }, children: 'GIBBERISH' } },
                    { type: 'div', props: { style: { fontSize: 9, fontWeight: 700, color: '#6a7282', letterSpacing: 2, marginTop: 2 }, children: 'CERTIFIED' } },
                  ],
                },
              },
              // Certify text
              { type: 'div', props: { style: { fontSize: 20, color: '#6a7282', marginTop: 14 }, children: 'This is to certify that' } },
              { type: 'div', props: { style: { fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: 3, marginTop: 4 }, children: 'THE FOLLOWING INDIVIDUAL' } },
              // Name
              { type: 'div', props: { style: { fontSize: nameSize, fontWeight: 700, color: '#1e2939', marginTop: 16 }, children: name } },
              // Divider
              { type: 'div', props: { style: { width: 60, height: 2, background: '#1e2939', marginTop: 10 } } },
              // Title
              { type: 'div', props: { style: { fontSize: 38, fontWeight: 700, color: '#1e2939', marginTop: 18 }, children: 'Licensed AI-Powered Insights' } },
              { type: 'div', props: { style: { fontSize: 38, fontWeight: 700, color: '#1e2939', marginTop: 4 }, children: 'Leverage Specialist\u2122' } },
              // Body text
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 16 },
                  children: [
                    { type: 'div', props: { style: { fontSize: 17, color: '#6a7282' }, children: 'has demonstrated exceptional proficiency in Leveraging Cross-Functional' } },
                    { type: 'div', props: { style: { fontSize: 17, color: '#6a7282', marginTop: 4 }, children: 'Synergies Across the Modern AI-Powered Data Stack and is hereby authorized' } },
                    { type: 'div', props: { style: { fontSize: 17, color: '#6a7282', marginTop: 4 }, children: 'to Drive Scalable, Enterprise-Grade, Value-Aligned Data Outcomes in any' } },
                    { type: 'div', props: { style: { fontSize: 17, color: '#6a7282', marginTop: 4 }, children: 'organization that has no idea what any of this means.' } },
                  ],
                },
              },
              // Specialization box
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: 4,
                    padding: '12px 40px',
                    marginTop: 16,
                    minWidth: 600,
                  },
                  children: [
                    { type: 'div', props: { style: { fontSize: 10, fontWeight: 700, color: '#6a7282', letterSpacing: 2.5 }, children: 'AREA OF SPECIALIZATION' } },
                    { type: 'div', props: { style: { fontSize: 18, fontWeight: 700, color: '#1e2939', marginTop: 8 }, children: specialization } },
                  ],
                },
              },
              // Footer divider
              { type: 'div', props: { style: { width: '90%', height: 1, background: '#cbd5e1', marginTop: 18 } } },
              // Footer columns
              {
                type: 'div',
                props: {
                  style: { display: 'flex', justifyContent: 'space-between', width: '90%', marginTop: 14 },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
                        children: [
                          { type: 'div', props: { style: { fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2 }, children: 'DATE OF ISSUE' } },
                          { type: 'div', props: { style: { fontSize: 16, color: '#6a7282', marginTop: 4 }, children: date } },
                        ],
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
                        children: [
                          { type: 'div', props: { style: { fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2 }, children: 'CERTIFICATE ID' } },
                          { type: 'div', props: { style: { fontSize: 16, color: '#6a7282', marginTop: 4 }, children: certId } },
                        ],
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
                        children: [
                          { type: 'div', props: { style: { fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2 }, children: 'VALID UNTIL' } },
                          { type: 'div', props: { style: { fontSize: 16, color: '#6a7282', marginTop: 4 }, children: 'The Next Reorg' } },
                        ],
                      },
                    },
                  ],
                },
              },
              // Issuer
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 16 },
                  children: [
                    { type: 'div', props: { style: { fontSize: 12, color: '#94a3b8' }, children: 'Issued by The Data Gibberish Institute for Enterprise Excellence' } },
                    { type: 'div', props: { style: { fontSize: 12, color: '#94a3b8', marginTop: 2 }, children: '& Advanced AI-Driven Thought Leadership\u2122' } },
                    { type: 'div', props: { style: { fontSize: 12, fontWeight: 700, color: '#94a3b8', marginTop: 2 }, children: 'datagibberish.com' } },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

async function generateCertificateImage(
  name: string,
  specialization: string,
  certId: string,
  date: string,
  assets: Fetcher,
): Promise<Uint8Array> {
  const fonts = await loadFonts(assets);

  const svg = await satori(certificateLayout(name, specialization, certId, date), {
    width: 1600,
    height: 900,
    fonts: [
      { name: 'DM Sans', data: fonts.regular, weight: 400, style: 'normal' as const },
      { name: 'DM Sans', data: fonts.bold, weight: 700, style: 'normal' as const },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'original' },
  });

  const rendered = resvg.render();
  const png = rendered.asPng();
  rendered.free();
  return png;
}

/* ── PDF generation ────────────────────────────────────── */

async function generateCertificatePDF(
  name: string,
  specialization: string,
  certId: string,
  date: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const dark = rgb(0.118, 0.161, 0.224);
  const muted = rgb(0.416, 0.447, 0.51);
  const light = rgb(0.58, 0.639, 0.722);
  const border = rgb(0.796, 0.835, 0.882);
  const boxBg = rgb(0.945, 0.961, 0.976); // #f1f5f9

  // Border
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderColor: border,
    borderWidth: 1,
  });

  const cx = width / 2;

  // "Certificate of Enterprise Excellence"
  const topLine = "CERTIFICATE OF ENTERPRISE EXCELLENCE";
  const topLineW = helveticaBold.widthOfTextAtSize(topLine, 8);
  page.drawText(topLine, {
    x: cx - topLineW / 2,
    y: height - 60,
    size: 8,
    font: helveticaBold,
    color: muted,
  });

  // Seal circle
  page.drawCircle({
    x: cx,
    y: height - 110,
    size: 28,
    borderColor: dark,
    borderWidth: 1.5,
    opacity: 0,
  });
  const dataW = helveticaBold.widthOfTextAtSize("DATA", 7);
  page.drawText("DATA", {
    x: cx - dataW / 2,
    y: height - 105,
    size: 7,
    font: helveticaBold,
    color: dark,
  });
  const gibW = helveticaBold.widthOfTextAtSize("GIBBERISH", 7);
  page.drawText("GIBBERISH", {
    x: cx - gibW / 2,
    y: height - 115,
    size: 7,
    font: helveticaBold,
    color: dark,
  });
  const certifiedW = helveticaBold.widthOfTextAtSize("CERTIFIED", 5);
  page.drawText("CERTIFIED", {
    x: cx - certifiedW / 2,
    y: height - 125,
    size: 5,
    font: helveticaBold,
    color: muted,
  });

  // "This is to certify that"
  const certifyText = "This is to certify that";
  const certifyW = helvetica.widthOfTextAtSize(certifyText, 12);
  page.drawText(certifyText, {
    x: cx - certifyW / 2,
    y: height - 160,
    size: 12,
    font: helvetica,
    color: muted,
  });

  // "THE FOLLOWING INDIVIDUAL"
  const awardedTo = "THE FOLLOWING INDIVIDUAL";
  const awardedW = helveticaBold.widthOfTextAtSize(awardedTo, 7);
  page.drawText(awardedTo, {
    x: cx - awardedW / 2,
    y: height - 176,
    size: 7,
    font: helveticaBold,
    color: light,
  });

  // Name
  const nameSize = name.length > 24 ? 28 : 34;
  const nameW = helveticaBold.widthOfTextAtSize(name, nameSize);
  page.drawText(name, {
    x: cx - nameW / 2,
    y: height - 210,
    size: nameSize,
    font: helveticaBold,
    color: dark,
  });

  // Divider
  page.drawLine({
    start: { x: cx - 30, y: height - 225 },
    end: { x: cx + 30, y: height - 225 },
    thickness: 2,
    color: dark,
  });

  // Title
  const titleLine1 = "Licensed AI-Powered Insights";
  const titleLine2 = "Leverage Specialist\u2122";
  const t1W = helveticaBold.widthOfTextAtSize(titleLine1, 22);
  const t2W = helveticaBold.widthOfTextAtSize(titleLine2, 22);
  page.drawText(titleLine1, {
    x: cx - t1W / 2,
    y: height - 255,
    size: 22,
    font: helveticaBold,
    color: dark,
  });
  page.drawText(titleLine2, {
    x: cx - t2W / 2,
    y: height - 280,
    size: 22,
    font: helveticaBold,
    color: dark,
  });

  // Body text
  const bodyLines = [
    "has demonstrated exceptional proficiency in Leveraging Cross-Functional",
    "Synergies Across the Modern AI-Powered Data Stack and is hereby authorized",
    "to Drive Scalable, Enterprise-Grade, Value-Aligned Data Outcomes in any",
    "organization that has no idea what any of this means.",
  ];
  let bodyY = height - 310;
  for (const line of bodyLines) {
    const lineW = helvetica.widthOfTextAtSize(line, 11);
    page.drawText(line, {
      x: cx - lineW / 2,
      y: bodyY,
      size: 11,
      font: helvetica,
      color: muted,
    });
    bodyY -= 16;
  }

  // Specialization box — filled rectangle with border
  const specSize = specialization.length > 50 ? 10 : 12;
  const specLabelText = "AREA OF SPECIALIZATION";
  const specLabelW = helveticaBold.widthOfTextAtSize(specLabelText, 6);
  const specW = helveticaBold.widthOfTextAtSize(specialization, specSize);
  const boxContentW = Math.max(specLabelW, specW);
  const boxPadX = 30;
  const boxPadY = 10;
  const boxW = boxContentW + boxPadX * 2;
  const boxH = 40;
  const boxX = cx - boxW / 2;
  const boxY = height - 413;

  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    color: boxBg,
    borderColor: border,
    borderWidth: 1,
  });

  page.drawText(specLabelText, {
    x: cx - specLabelW / 2,
    y: boxY + boxH - boxPadY - 6,
    size: 6,
    font: helveticaBold,
    color: muted,
  });

  page.drawText(specialization, {
    x: cx - specW / 2,
    y: boxY + boxPadY,
    size: specSize,
    font: helveticaBold,
    color: dark,
  });

  // Footer divider
  page.drawLine({
    start: { x: 80, y: height - 430 },
    end: { x: width - 80, y: height - 430 },
    thickness: 0.5,
    color: border,
  });

  // Footer columns
  const footerY = height - 455;
  const footerLabelY = height - 445;
  const cols = [
    { label: "DATE OF ISSUE", value: date },
    { label: "CERTIFICATE ID", value: certId },
    { label: "VALID UNTIL", value: "The Next Reorg" },
  ];
  const colPositions = [width * 0.2, width * 0.5, width * 0.8];

  cols.forEach((col, i) => {
    const lW = helveticaBold.widthOfTextAtSize(col.label, 6);
    page.drawText(col.label, {
      x: colPositions[i] - lW / 2,
      y: footerLabelY,
      size: 6,
      font: helveticaBold,
      color: light,
    });
    const vW = helvetica.widthOfTextAtSize(col.value, 10);
    page.drawText(col.value, {
      x: colPositions[i] - vW / 2,
      y: footerY,
      size: 10,
      font: helvetica,
      color: muted,
    });
  });

  // Issuer
  const issuer1 = "Issued by The Data Gibberish Institute for Enterprise Excellence";
  const issuer2 = "& Advanced AI-Driven Thought Leadership\u2122";
  const issuer3 = "datagibberish.com";
  const i1W = helvetica.widthOfTextAtSize(issuer1, 7);
  const i2W = helvetica.widthOfTextAtSize(issuer2, 7);
  const i3W = helveticaBold.widthOfTextAtSize(issuer3, 7);
  page.drawText(issuer1, {
    x: cx - i1W / 2,
    y: height - 485,
    size: 7,
    font: helvetica,
    color: light,
  });
  page.drawText(issuer2, {
    x: cx - i2W / 2,
    y: height - 496,
    size: 7,
    font: helvetica,
    color: light,
  });
  page.drawText(issuer3, {
    x: cx - i3W / 2,
    y: height - 507,
    size: 7,
    font: helveticaBold,
    color: light,
  });

  return await pdfDoc.save();
}

/* ── SendFox ───────────────────────────────────────────── */

async function addToSendFox(
  env: Env,
  email: string,
  name: string,
): Promise<void> {
  const nameParts = name.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || "";

  const res = await fetch("https://api.sendfox.com/contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SENDFOX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      first_name: firstName,
      last_name: lastName,
      lists: env.SENDFOX_LIST_ID.split(",").map((id) => Number(id.trim())),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SendFox ${res.status}: ${text}`);
  }
}

/* ── Email ─────────────────────────────────────────────── */

async function sendCertificateEmail(
  env: Env,
  email: string,
  name: string,
  certId: string,
  pdfBytes: Uint8Array,
): Promise<void> {
  let binary = "";
  for (let i = 0; i < pdfBytes.length; i++) {
    binary += String.fromCharCode(pdfBytes[i]);
  }
  const pdfBase64 = btoa(binary);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [email],
      subject: `Your Official Certification: Licensed AI-Powered Insights Leverage Specialist\u2122 (${certId})`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #1e2939;">Congratulations, ${name}!</h2>
          <p style="color: #6a7282; line-height: 1.6;">
            Your official <strong>Licensed AI-Powered Insights Leverage Specialist\u2122</strong> certificate is attached to this email.
          </p>
          <p style="color: #6a7282; line-height: 1.6;">
            Certificate ID: <strong>${certId}</strong>
          </p>
          <p style="color: #6a7282; line-height: 1.6;">
            You are now fully authorized to leverage synergies, drive outcomes, and add this to your LinkedIn headline.
          </p>
          <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px 24px; margin: 24px 0;">
            <p style="color: #1e2939; font-weight: 700; font-size: 16px; margin: 0 0 8px;">
              You also earned a 50% discount — forever.
            </p>
            <p style="color: #6a7282; line-height: 1.6; margin: 0 0 12px;">
              As a certified specialist, you've unlocked a permanent 50% discount on Data Gibberish.
            </p>
            <a href="https://www.datagibberish.com/03346847" style="display: inline-block; background: #1e2939; color: #ffffff; padding: 12px 24px; border-radius: 6px; font-weight: 600; text-decoration: none;">Claim Your 50% Discount →</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e5ea; margin: 24px 0;">
          <p style="color: #94a3b8; font-size: 13px;">
            Issued by The Data Gibberish Institute for Enterprise Excellence & Advanced AI-Driven Thought Leadership\u2122
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Data-Gibberish-Certificate-${certId}.pdf`,
          content: pdfBase64,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text}`);
  }
}
