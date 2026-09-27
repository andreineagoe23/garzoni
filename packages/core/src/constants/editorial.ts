/**
 * The single author/editor profile behind Garzoni's lessons and guides (E-E-A-T).
 * Web renders the /authors page, bylines and Person JSON-LD from this object;
 * translated copy (bio, job title, disclaimer) lives in locales under `editorial`.
 *
 * Only verifiable facts belong here. Do not add credentials, employers or
 * reviewers that cannot be backed up.
 */

const SITE_URL = "https://www.garzoni.app";

/** @id of the Organization node in index.html; the author's employer + publisher. */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export type EditorialAuthor = {
  slug: string;
  name: string;
  /** Site-relative path of the profile page. */
  path: string;
  /** Absolute profile URL. */
  url: string;
  /** Stable JSON-LD @id every lesson and guide references as author. */
  id: string;
  /** Absolute URL of a headshot. Empty → no image in markup. */
  image: string;
  /** Public profiles (LinkedIn, GitHub, …). Empty entries are dropped. */
  sameAs: string[];
  alumniOf: string;
  degree: string;
};

export const FOUNDER_AUTHOR: EditorialAuthor = {
  slug: "andrei-neagoe",
  name: "Andrei Neagoe",
  path: "/authors/andrei-neagoe",
  url: `${SITE_URL}/authors/andrei-neagoe`,
  id: `${SITE_URL}/authors/andrei-neagoe#person`,
  // OWNER: set to an absolute https URL of a headshot to show it on the
  // profile page and in Person JSON-LD. Left empty, nothing is emitted.
  image: "",
  // OWNER: add profile URLs, e.g. "https://www.linkedin.com/in/<handle>".
  // Left empty, no sameAs is emitted.
  sameAs: [],
  alumniOf: "Queen Mary University of London",
  degree: "BSc Computer Science",
};

export const EDITORIAL_STANDARDS_PATH = "/editorial-standards";

/**
 * Bylines stored on content before the author profile existed. Any of these
 * resolve to the founder profile; any other name is a guest author.
 */
const HOUSE_BYLINES = new Set(["", "garzoni", "garzoni team", "andrei neagoe"]);

export function isFounderByline(author?: string | null): boolean {
  return HOUSE_BYLINES.has((author ?? "").trim().toLowerCase());
}
