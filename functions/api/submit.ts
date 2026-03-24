import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface Env {
  SENDFOX_API_KEY: string;
  SENDFOX_LIST_ID: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
}

interface CertRequest {
  name: string;
  email: string;
  specialization: string;
  certId: string;
  date: string;
}

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
        { status: 400, headers: corsHeaders }
      );
    }

    // Run SendFox (fire-and-forget) + PDF generation in parallel
    const sendFoxPromise = addToSendFox(context.env, email, name).catch(
      (err) => console.error("SendFox error:", err)
    );

    const pdfPromise = generateCertificatePDF(
      name,
      specialization,
      certId,
      date
    );

    const [, pdfBytes] = await Promise.all([sendFoxPromise, pdfPromise]);

    // Send email with PDF attachment via Resend
    await sendCertificateEmail(
      context.env,
      email,
      name,
      certId,
      pdfBytes
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("Submit error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to process certification",
      }),
      { status: 500, headers: corsHeaders }
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

async function addToSendFox(
  env: Env,
  email: string,
  name: string
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

async function generateCertificatePDF(
  name: string,
  specialization: string,
  certId: string,
  date: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const dark = rgb(0.118, 0.161, 0.224); // #1e2939
  const muted = rgb(0.416, 0.447, 0.51); // #6a7282
  const light = rgb(0.58, 0.639, 0.722); // #94a3b8
  const border = rgb(0.796, 0.835, 0.882); // #cbd5e1

  // Border lines
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

  // Specialization box
  const specLabelText = "AREA OF SPECIALIZATION";
  const specLabelW = helveticaBold.widthOfTextAtSize(specLabelText, 6);
  page.drawText(specLabelText, {
    x: cx - specLabelW / 2,
    y: height - 385,
    size: 6,
    font: helveticaBold,
    color: muted,
  });

  const specSize = specialization.length > 50 ? 10 : 12;
  const specW = helveticaBold.widthOfTextAtSize(specialization, specSize);
  page.drawText(specialization, {
    x: cx - specW / 2,
    y: height - 400,
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

async function sendCertificateEmail(
  env: Env,
  email: string,
  name: string,
  certId: string,
  pdfBytes: Uint8Array
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
      subject: `Your Official Certification: Licensed AI-Powered Insights Leverage Specialist™ (${certId})`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #1e2939;">Congratulations, ${name}!</h2>
          <p style="color: #6a7282; line-height: 1.6;">
            Your official <strong>Licensed AI-Powered Insights Leverage Specialist™</strong> certificate is attached to this email.
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
            Issued by The Data Gibberish Institute for Enterprise Excellence & Advanced AI-Driven Thought Leadership™
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
