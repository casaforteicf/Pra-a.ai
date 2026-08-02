import { vendorPool } from "./vendorDb";

export interface StoryItem {
  id: string;
  mediaType: "foto" | "video";
  mediaUrl: string;
  produtoId: string | null;
  linkUrl: string | null;
  caption: string | null;
  createdAt: string;
}

export interface VendorStoriesGroup {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  logoUrl: string | null;
  stories: StoryItem[];
}

// Stories ativos e não expirados de todos os tenants que vendem no Praça.ai,
// agrupados por loja — a home mostra uma bolinha por loja (a mais recente
// primeiro), igual Instagram Stories.
export async function getActiveStoriesGrouped(): Promise<VendorStoriesGroup[]> {
  const result = await vendorPool.query(
    `SELECT
       vs.id, vs.media_type, vs.media_url, vs.produto_id, vs.link_url, vs.caption, vs.created_at,
       t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug, t.logo_url
     FROM vendor_stories vs
     JOIN tenants t ON t.id = vs.tenant_id
     WHERE vs.ativo = true
       AND vs.expires_at > now()
       AND t.vende_no_praca_ai = true
     ORDER BY t.name, vs.created_at ASC`,
  );

  const groups = new Map<string, VendorStoriesGroup>();
  for (const row of result.rows) {
    if (!groups.has(row.tenant_id)) {
      groups.set(row.tenant_id, {
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        tenantSlug: row.tenant_slug,
        logoUrl: row.logo_url,
        stories: [],
      });
    }
    groups.get(row.tenant_id)!.stories.push({
      id: row.id,
      mediaType: row.media_type,
      mediaUrl: row.media_url,
      produtoId: row.produto_id,
      linkUrl: row.link_url,
      caption: row.caption,
      createdAt: row.created_at,
    });
  }

  // Loja com o story mais recente aparece primeiro na fileira.
  return [...groups.values()].sort(
    (a, b) => +new Date(b.stories[b.stories.length - 1].createdAt) - +new Date(a.stories[a.stories.length - 1].createdAt),
  );
}

export async function registerStoryView(storyId: string): Promise<void> {
  await vendorPool.query(`UPDATE vendor_stories SET views_count = views_count + 1 WHERE id = $1`, [storyId]);
}
