import { readPreview } from "@/lib/site/preview";

export const dynamic = "force-dynamic";

type Body = {
  url?: unknown;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Body | null;

  if (typeof body?.url !== "string") {
    return Response.json(
      { error: "Paste a full https link." },
      { status: 400 },
    );
  }

  try {
    const preview = await readPreview(body.url);

    return Response.json(preview);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "That page did not load.";

    return Response.json(
      { error: message },
      { status: 400 },
    );
  }
}
