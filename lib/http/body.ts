export class RequestBodyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
/** Enforce the actual streamed size, including requests with no Content-Length header. */
export async function readJsonBody(
  request: Request,
  limit: number,
): Promise<unknown> {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new RequestBodyError("This request is too large.", 413);
  if (!request.body)
    throw new RequestBodyError("A JSON request body is required.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new RequestBodyError("This request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new RequestBodyError("Send a valid JSON request body.", 400);
  }
}
