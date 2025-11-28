// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type QueryParams = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  categories?: string[];
  priceTiers?: number[];
  vibes?: string[];
  excludeIds?: string[];
  page?: number;
  pageSize?: number;
};

function toArray(value: string | null | undefined): string[] | undefined {
  if (!value) return undefined;
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const qp: QueryParams = {
      lat: url.searchParams.get("lat") ? Number(url.searchParams.get("lat")) : undefined,
      lng: url.searchParams.get("lng") ? Number(url.searchParams.get("lng")) : undefined,
      radiusKm: url.searchParams.get("radiusKm") ? Number(url.searchParams.get("radiusKm")) : 15,
      categories: toArray(url.searchParams.get("categories")),
      priceTiers: toArray(url.searchParams.get("priceTiers"))?.map((n) => Number(n)),
      vibes: toArray(url.searchParams.get("vibes")),
      excludeIds: toArray(url.searchParams.get("excludeIds")),
      page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : 0,
      pageSize: url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : 20,
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Base query: published listings
    let query = supabase
      .from("listings")
      .select("id,title,subtitle,description,category,price_tier,latitude,longitude,city,is_featured,created_at, listing_photos(url,sort_order)")
      .eq("is_published", true);

    if (qp.categories && qp.categories.length) {
      query = query.in("category", qp.categories);
    }

    if (qp.priceTiers && qp.priceTiers.length) {
      query = query.in("price_tier", qp.priceTiers);
    }

    if (qp.excludeIds && qp.excludeIds.length) {
      query = query.not("id", "in", `(${qp.excludeIds.join(",")})`);
    }

    // Fetch
    const { data, error } = await query.limit(1000);
    if (error) throw error;

    // Client-side distance filter/sort (no PostGIS). In production, use SQL extensions.
    const withDistance = (data ?? []).map((row: any) => {
      const distanceKm = qp.lat !== undefined && qp.lng !== undefined
        ? haversineKm(qp.lat, qp.lng, row.latitude, row.longitude)
        : null;
      return { ...row, distanceKm };
    });

    let filtered = withDistance;
    if (qp.radiusKm && qp.lat !== undefined && qp.lng !== undefined) {
      filtered = filtered.filter((r) => r.distanceKm === null || r.distanceKm <= qp.radiusKm!);
    }

    // Sort: featured first, then distance, then freshness
    filtered.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const start = (qp.page ?? 0) * (qp.pageSize ?? 20);
    const end = start + (qp.pageSize ?? 20);
    const pageData = filtered.slice(start, end);

    return new Response(JSON.stringify({ items: pageData, total: filtered.length }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { "content-type": "application/json" },
      status: 500,
    });
  }
});
