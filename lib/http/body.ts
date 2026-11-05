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
  const lengthHeader = Number(request.headers.get("content-length") || 0);
  if (lengthHeader > limit)
    throw new RequestBodyError("This request is too large.", 413);
  if (!request.body)
    throw new RequestBodyError("A JSON request body is required.", 400);

  const encoding = (
    request.headers.get("x-content-encoding") ||
    request.headers.get("content-encoding") ||
    ""
  ).toLowerCase();

  let stream: ReadableStream<Uint8Array> = request.body;
  if (encoding.includes("gzip")) {
    try {
      stream = request.body.pipeThrough(new DecompressionStream("gzip"));
    } catch {
      throw new RequestBodyError("Send a valid compressed request body.", 400);
    }
  } else if (encoding.includes("deflate")) {
    try {
      stream = request.body.pipeThrough(new DecompressionStream("deflate"));
    } catch {
      throw new RequestBodyError("Send a valid compressed request body.", 400);
    }
  }

  const reader = stream.getReader();
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
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError("Send a valid request body.", 400);
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
