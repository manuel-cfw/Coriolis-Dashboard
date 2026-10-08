import { api, getSession } from "./api";
import type { GroupListEntry } from "./types";

// Ergebnis pro angemeldetem Nutzer merken – die Gruppenliste ändert sich während einer Sitzung kaum
let cached: { userId: string; group: GroupListEntry | null } | null = null;

/**
 * Ist der angemeldete Nutzer in genau einer Coriolis-Gruppe, ist das die
 * Standard-Gruppe für den Raum. Bei keiner oder mehreren Gruppen: null.
 */
export async function getDefaultGroup(): Promise<GroupListEntry | null> {
  const session = getSession();
  if (!session) return null;
  if (cached?.userId === session.user.id) return cached.group;
  try {
    const groups = await api.groups();
    const group = groups.length === 1 ? groups[0] : null;
    cached = { userId: session.user.id, group };
    return group;
  } catch {
    return null;
  }
}
