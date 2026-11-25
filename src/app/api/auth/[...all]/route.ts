import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

async function handler(request: Request) {
  const auth = await getAuth();
  const handlers = toNextJsHandler(auth);
  return request.method === "POST" ? handlers.POST(request) : handlers.GET(request);
}

export { handler as GET, handler as POST };
