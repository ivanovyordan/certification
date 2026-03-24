interface Env {
  CERT_IMAGES: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const certId = context.params.certId as string;

  const object = await context.env.CERT_IMAGES.get(`certs/${certId}.png`);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
