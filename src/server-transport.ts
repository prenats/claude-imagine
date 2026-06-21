/**
 * HTTP transport options for remote ComfyUI gateways (Bearer auth, internal TLS).
 */

let bearerToken: string | undefined;
let tlsInsecureApplied = false;

export function configureServerTransport(opts: {
  token?: string;
  tlsInsecure?: boolean;
}): void {
  bearerToken = opts.token?.trim() || undefined;

  if (opts.tlsInsecure && !tlsInsecureApplied) {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
    tlsInsecureApplied = true;
  }
}

export function buildAuthHeaders(existing?: HeadersInit): Headers {
  const headers = new Headers(existing);
  if (bearerToken) {
    headers.set('Authorization', `Bearer ${bearerToken}`);
  }
  return headers;
}

/** Reset transport state — for tests only. */
export function resetServerTransportForTests(): void {
  bearerToken = undefined;
  tlsInsecureApplied = false;
}
