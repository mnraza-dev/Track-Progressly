export function hasAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const source = new URL(origin);
    if (source.protocol !== "https:" && source.protocol !== "http:")
      return false;
    // Next.js can construct request.url with an internal server hostname.
    // Match the public host headers, as its Server Actions origin check does.
    const forwarded = request.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    const host = request.headers.get("host")?.trim();
    if (forwarded || host)
      return [forwarded, host].some(
        (value) => value?.toLowerCase() === source.host,
      );
    return source.origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
