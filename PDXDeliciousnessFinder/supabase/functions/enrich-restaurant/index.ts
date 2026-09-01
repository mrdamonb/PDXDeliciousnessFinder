import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Portland metro bias for Google Places text search.
const PORTLAND_LAT = 45.5152;
const PORTLAND_LNG = -122.6784;
const PORTLAND_RADIUS_M = 25000;

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

interface GooglePlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  websiteUri?: string;
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  priceLevel?: string;
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

function mapGoogleTypesToVenueType(
  types: string[],
  primaryType: string | undefined,
): "restaurant" | "bar" | "brewery" | "foodCart" {
  const all = new Set<string>(types.map((t) => t.toLowerCase()));
  if (primaryType) all.add(primaryType.toLowerCase());

  if (all.has("brewery") || all.has("microbrewery")) return "brewery";
  if (all.has("bar") || all.has("pub") || all.has("wine_bar") || all.has("cocktail_bar") || all.has("night_club")) return "bar";
  if (all.has("food_truck") || all.has("food_court")) return "foodCart";
  return "restaurant";
}

function mapPriceLevel(level: string | undefined): "$" | "$$" | "$$$" | "$$$$" | null {
  switch (level) {
    case "PRICE_LEVEL_INEXPENSIVE": return "$";
    case "PRICE_LEVEL_MODERATE": return "$$";
    case "PRICE_LEVEL_EXPENSIVE": return "$$$";
    case "PRICE_LEVEL_VERY_EXPENSIVE": return "$$$$";
    default: return null;
  }
}

const genericTypes = new Set([
  "restaurant", "bar", "food", "point_of_interest", "establishment",
  "meal_takeaway", "meal_delivery", "store", "food_court", "food_truck",
]);

function extractCuisine(place: GooglePlace): string | null {
  const display = place.primaryTypeDisplayName?.text;
  if (display && display.length > 0) {
    return display
      .replace(/\s+(Restaurant|Bar|Cafe|Café|Brewery)$/i, "")
      .trim() || null;
  }

  const types = place.types ?? [];
  const specific = types.find((t) => !genericTypes.has(t.toLowerCase()));
  if (!specific) return null;
  return specific
    .replace(/_restaurant$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function enrichWithGooglePlaces(term: string, apiKey: string): Promise<EnrichedPlace> {
  const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.location,places.websiteUri,places.types,places.primaryType,places.primaryTypeDisplayName,places.priceLevel",
    },
    body: JSON.stringify({
      textQuery: term,
      locationBias: {
        circle: {
          center: { latitude: PORTLAND_LAT, longitude: PORTLAND_LNG },
          radius: PORTLAND_RADIUS_M,
        },
      },
      pageSize: 1,
    }),
  });

  const text = await resp.text();
  console.log("[enrich-restaurant] Google status:", resp.status, "body:", text.slice(0, 300));
  if (!resp.ok) throw new Error(`Google Places HTTP ${resp.status}: ${text}`);

  const json = JSON.parse(text);
  const p: GooglePlace | undefined = json?.places?.[0];
  if (!p) return {};

  const types = p.types ?? [];
  return {
    name: p.displayName?.text ?? null,
    address: p.formattedAddress ?? null,
    latitude: p.location?.latitude ?? null,
    longitude: p.location?.longitude ?? null,
    website: p.websiteUri ?? null,
    venueType: mapGoogleTypesToVenueType(types, p.primaryType),
    cuisine: extractCuisine(p),
    priceRange: mapPriceLevel(p.priceLevel),
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

    const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!googleKey) {
      return new Response(
        JSON.stringify({ success: false, error: "GOOGLE_PLACES_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let enriched: EnrichedPlace;
    try {
      enriched = await enrichWithGooglePlaces(term, googleKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google Places enrichment error";
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
