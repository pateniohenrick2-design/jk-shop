// Shared by the /api/saved-accounts route and the order form (safe to import in the browser).

// "User ID", "Enter User ID", "user id:" → "userid" so the same detail matches across categories
export function normalizeLabel(label: string) {
  return label.replace(/^enter\s+/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Short name for a saved account: its IGN / username when it has one, otherwise its ID
export function savedAccountName(acc: { display: { label: string; value: string }[] }) {
  const norm = acc.display.map((d) => ({ key: normalizeLabel(d.label), value: d.value }));
  const isServer = (k: string) => /server|zone/.test(k);
  const name = norm.find((d) => /ign|username|displayname|ingamename|gamename|nickname|playername|riotid|^name$/.test(d.key) && !isServer(d.key));
  if (name) return name.value;
  const id = norm.find((d) => /id$|^id|uid/.test(d.key) && !isServer(d.key));
  return (id ?? norm[0])?.value ?? '';
}

export type SavedAccount = {
  key: string;
  values: Record<string, string>; // normalized label → value
  display: { label: string; value: string }[];
  lastUsed: string;
};
