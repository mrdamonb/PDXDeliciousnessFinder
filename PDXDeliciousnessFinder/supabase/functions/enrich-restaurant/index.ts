import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  name?: string;
  url?: string;
  address?: string;
}

interface EnrichedPlace {
  name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  website?: string | null;
  cuisine?: string | null;
  venueType?: "restaurant" | "bar" | "brewery" | "foodCart" | null;
  priceRange?: "$" | "$$" | "$$$" | "$$$$" | null;
}

function isYelpUrl(url: string): boolean {
  return url.includes("yelp.com");
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PDXDeliciousnessFinder/1.0)" },
    });
    return await resp.text();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

async function extractNameFromYelpUrl(url: string): Promise<string | null> {
  try {
    let fullUrl = url;

    if (!url.includes("/biz/")) {
      const html = await fetchWithTimeout(url, 5000);
      if (!html) return null;
      // The redirect target is in resp.url, but fetchWithTimeout doesn't expose it.
      // Re-fetch just to follow the redirect and get the final URL.
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      try {
        const resp = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
        fullUrl = resp.url;
      } finally {
        clearTimeout(id);
      }
    }

    const bizMatch = fullUrl.match(/\/biz\/([^/?#]+)/);
    if (!bizMatch) return null;

    const slug = bizMatch[1];
    const parts = slug.split("-");

    let endIdx = parts.length;
    if (endIdx > 1 && /^\d+$/.test(parts[endIdx - 1])) endIdx--;

    const citySuffixes = ["portland", "beaverton", "hillsboro", "gresham", "tigard", "oregon", "or", "lake", "oswego"];
    while (endIdx > 1 && citySuffixes.includes(parts[endIdx - 1].toLowerCase())) endIdx--;

    return parts.slice(0, endIdx).join(" ");
  } catch {
    return null;
  }
}

async function extractNameFromGenericUrl(url: string): Promise<string | null> {
  const html = await fetchWithTimeout(url, 5000);
  if (!html) return extractNameFromDomain(url);

  // og:title is usually just the business name
  const ogMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (ogMatch?.[1]) return ogMatch[1].trim();

  // <title> — take the part before the first separator
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    const name = titleMatch[1].trim().split(/\s*[\|\-–—]\s*/)[0].trim();
    if (name.length > 0 && name.length < 60) return name;
  }

  return extractNameFromDomain(url);
}

function extractNameFromDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const domainBase = hostname.split(".")[0];
    const suffixes = ["restaurant", "restaurants", "bar", "bars", "cafe", "coffee", "brewery", "pdx", "portland", "eats", "kitchen", "grill", "bistro"];
    let name = domainBase;
    for (const suffix of suffixes) {
      if (name.toLowerCase().endsWith(suffix) && name.length > suffix.length) {
        name = name.slice(0, name.length - suffix.length);
      }
    }
    return name || domainBase;
  } catch {
    return null;
  }
}

async function buildSearchTerm(body: RequestBody): Promise<string | null> {
  if (body.name) return body.name;
  if (body.url) {
    if (isYelpUrl(body.url)) return await extractNameFromYelpUrl(body.url);
    return await extractNameFromGenericUrl(body.url);
  }
  if (body.address) return body.address;
  return null;
}

function mapYelpCategoriesToVenueType(
  categories: Array<{ alias: string; title: string }>
): "restaurant" | "bar" | "brewery" | "foodCart" {
  for (const cat of categories) {
    const alias = cat.alias.toLowerCase();
    const title = cat.title.toLowerCase();
    if (alias.includes("brewery") || alias.includes("brewpub") || title.includes("brewery") || title.includes("brewpub")) return "brewery";
    if (alias === "bars" || alias.includes("pub") || title.includes("bar") || title.includes("pub")) return "bar";
    if (alias.includes("foodtrucks") || alias.includes("food_court") || alias.includes("foodstands") || title.includes("food truck") || title.includes("food cart")) return "foodCart";
  }
  return "restaurant";
}

const genericAliases = new Set(["restaurants", "bars", "breweries", "food", "foodtrucks", "nightlife", "foodcourt"]);

function extractCuisine(categories: Array<{ alias: string; title: string }>): string | null {
  const nonGeneric = categories.find(c => !genericAliases.has(c.alias.toLowerCase()));
  return nonGeneric?.title ?? null;
}

async function enrichWithYelp(term: string, apiKey: string): Promise<EnrichedPlace> {
  const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(term)}&location=Portland%2C+OR&limit=1`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  const text = await resp.text();
  console.log("[enrich-restaurant] Yelp status:", resp.status, "body:", text.slice(0, 300));
  if (!resp.ok) throw new Error(`Yelp HTTP ${resp.status}: ${text}`);

  const json = JSON.parse(text);
  const b = json?.businesses?.[0];
  if (!b) return {};

  const categories = (b.categories as Array<{ alias: string; title: string }>) ?? [];
  const location = b.location as Record<string, unknown> | undefined;
  const coords = b.coordinates as { latitude?: number; longitude?: number } | undefined;
  const addressParts = location?.display_address as string[] | undefined;

  return {
    name: (b.name as string) ?? null,
    address: addressParts?.join(", ") ?? null,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    website: (b.url as string) ?? null,
    venueType: mapYelpCategoriesToVenueType(categories),
    cuisine: extractCuisine(categories),
    priceRange: (b.price as "$" | "$$" | "$$$" | "$$$$") ?? null,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();

    if (!body.name && !body.url && !body.address) {
      return new Response(
        JSON.stringify({ success: false, error: "No search query provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const term = await buildSearchTerm(body);
    if (!term) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not extract restaurant name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const yelpKey = Deno.env.get("YELP_API_KEY");
    if (!yelpKey) {
      return new Response(
        JSON.stringify({ success: false, error: "YELP_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let enriched: EnrichedPlace;
    try {
      enriched = await enrichWithYelp(term, yelpKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Yelp enrichment error";
      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: enriched }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
