// Storage for subscriptions and payment proofs, using Netlify Blobs (built into Netlify, no setup).
// Tests replace it by setting globalThis.__LEDGER_STORES__ to an in-memory store with the same methods.

let cached = null;
export async function stores() {
  if (globalThis.__LEDGER_STORES__) return globalThis.__LEDGER_STORES__;
  if (cached) return cached;
  const { getStore } = await import('@netlify/blobs');
  const subs = getStore({ name: 'ledger-subscriptions', consistency: 'strong' });
  const proofs = getStore({ name: 'ledger-payment-proofs', consistency: 'strong' });
  const accts = getStore({ name: 'ledger-accounts', consistency: 'strong' });
  const rates = getStore({ name: 'ledger-rates', consistency: 'strong' });
  cached = {
    getSub: id => subs.get(id, { type: 'json' }),
    putSub: rec => subs.setJSON(rec.id, rec),
    // Shared rate counters (every server instance sees the same numbers). Each hit is its own small record under the
    // window's prefix, so two requests at the same moment can't overwrite each other; the count is how many records the window holds.
    hit: async (name, key, windowMs, record = true) => {
      const now = Date.now(), end = (Math.floor(now / windowMs) + 1) * windowMs;
      const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(key)))), x => x.toString(16).padStart(2, '0')).join('').slice(0, 24);
      const prefix = `${name}|${h}|${end}|`;
      if (record) await rates.set(prefix + now + '-' + Math.random().toString(36).slice(2, 8), '1');
      return (await rates.list({ prefix })).blobs.length;
    },
    sweepRates: async () => {
      const now = Date.now(); let n = 0;
      for (const b of (await rates.list()).blobs) { const end = Number(b.key.split('|')[2]); if (end && end < now) { await rates.delete(b.key); n++; } }
      return n;
    },
    getAcct: key => accts.get(key, { type: 'json' }),
    putAcct: rec => accts.setJSON(rec.key, rec),
    listSubIds: async () => (await subs.list()).blobs.map(b => b.key),
    putProof: (key, bytes, type) => proofs.set(key, bytes, { metadata: { type } }),
    getProof: async key => {
      const r = await proofs.getWithMetadata(key, { type: 'arrayBuffer' });
      return r ? { bytes: r.data, type: (r.metadata && r.metadata.type) || 'application/octet-stream' } : null;
    }
  };
  return cached;
}
