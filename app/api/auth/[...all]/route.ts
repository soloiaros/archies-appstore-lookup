import { getAuth } from "@/lib/auth";

async function handle(request: Request) {
  const auth = await getAuth();

  return auth.handler(request);
}

export const GET = handle;

export const POST = handle;
