import { describe, expect, it } from "vitest";
import { readJsonBody } from "@/lib/http/body";
describe("bounded JSON request bodies", () => {
  it("reads UTF-8 JSON across chunks", async () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ note: "Hello 🌱" }),
    );
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, 17));
        controller.enqueue(bytes.slice(17));
        controller.close();
      },
    });
    const request = new Request("https://example.test", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(await readJsonBody(request, 100)).toEqual({ note: "Hello 🌱" });
  });
  it("rejects oversized streamed data without relying on Content-Length", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(1000) }),
    });
    await expect(readJsonBody(request, 100)).rejects.toMatchObject({
      status: 413,
    });
  });
  it("reads and decompresses gzip payload with Content-Encoding", async () => {
    const raw = JSON.stringify({ message: "compressed gzip 🌱", count: 42 });
    const stream = new Response(raw).body!.pipeThrough(
      new CompressionStream("gzip"),
    );
    const compressed = await new Response(stream).arrayBuffer();
    const request = new Request("https://example.test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
      },
      body: compressed,
    });
    expect(await readJsonBody(request, 1000)).toEqual({
      message: "compressed gzip 🌱",
      count: 42,
    });
  });
  it("reads and decompresses gzip payload with x-content-encoding", async () => {
    const raw = JSON.stringify({ message: "custom header gzip", count: 99 });
    const stream = new Response(raw).body!.pipeThrough(
      new CompressionStream("gzip"),
    );
    const compressed = await new Response(stream).arrayBuffer();
    const request = new Request("https://example.test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-content-encoding": "gzip",
      },
      body: compressed,
    });
    expect(await readJsonBody(request, 1000)).toEqual({
      message: "custom header gzip",
      count: 99,
    });
  });
  it("rejects decompression bomb when decompressed data exceeds limit", async () => {
    const raw = JSON.stringify({ huge: "a".repeat(2000) });
    const stream = new Response(raw).body!.pipeThrough(
      new CompressionStream("gzip"),
    );
    const compressed = await new Response(stream).arrayBuffer();
    const request = new Request("https://example.test", {
      method: "POST",
      headers: { "x-content-encoding": "gzip" },
      body: compressed,
    });
    await expect(readJsonBody(request, 500)).rejects.toMatchObject({
      status: 413,
    });
  });
  it("returns a client error for malformed JSON or a missing body", async () => {
    await expect(
      readJsonBody(
        new Request("https://example.test", { method: "POST", body: "{" }),
        100,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      readJsonBody(
        new Request("https://example.test", { method: "POST" }),
        100,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
