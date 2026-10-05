// Storage for subscriptions and payment proofs, using Netlify Blobs (built into Netlify, no setup).
// Tests replace it by setting globalThis.__LEDGER_STORES__ to an in-memory store with the same methods.

let cached = null;
export async function stores() {
  if (globalThis.__LEDGER_STORES__) return globalThis.__LEDGER_STORES__;
  if (cached) return cached;
  const { getStore } = await import('@netlify/blobs');
  const subs = getStore({ name: 'ledger-subscriptions', consistency: 'strong' });
  const proofs = getStore({ name: 'ledger-payment-proofs', consistency: 'strong' });
  cached = {
    getSub: id => subs.get(id, { type: 'json' }),
    putSub: rec => subs.setJSON(rec.id, rec),
    listSubIds: async () => (await subs.list()).blobs.map(b => b.key),
    putProof: (key, bytes, type) => proofs.set(key, bytes, { metadata: { type } }),
    getProof: async key => {
      const r = await proofs.getWithMetadata(key, { type: 'arrayBuffer' });
      return r ? { bytes: r.data, type: (r.metadata && r.metadata.type) || 'application/octet-stream' } : null;
    }
  };
  return cached;
}
