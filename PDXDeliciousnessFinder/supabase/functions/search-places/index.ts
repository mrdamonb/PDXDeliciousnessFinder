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
  query: string;
  limit?: number;
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
  // Prefer primaryTypeDisplayName ("Thai Restaurant"), stripping the trailing word.
  const display = place.primaryTypeDisplayName?.text;
  if (display && display.length > 0) {
    return display
      .replace(/\s+(Restaurant|Bar|Cafe|Café|Brewery)$/i, "")
      .trim() || null;
  }

  // Fallback: find the first non-generic type and humanize it.
  const types = place.types ?? [];
  const specific = types.find((t) => !genericTypes.has(t.toLowerCase()));
  if (!specific) return null;
  return specific
    .replace(/_restaurant$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function searchWithGooglePlaces(query: string, limit: number, apiKey: string): Promise<EnrichedPlace[]> {
  const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.location,places.websiteUri,places.types,places.primaryType,places.primaryTypeDisplayName,places.priceLevel",
    },
    body: JSON.stringify({
      textQuery: query,
      locationBias: {
        circle: {
          center: { latitude: PORTLAND_LAT, longitude: PORTLAND_LNG },
          radius: PORTLAND_RADIUS_M,
        },
      },
      pageSize: limit,
    }),
  });

  const text = await resp.text();
  console.log("[search-places] Google status:", resp.status, "body:", text.slice(0, 300));
  if (!resp.ok) throw new Error(`Google Places HTTP ${resp.status}: ${text}`);

  const json = JSON.parse(text);
  const places: GooglePlace[] = json?.places ?? [];
  if (!Array.isArray(places)) return [];

  return places.map((p) => {
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
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();

    if (!body.query || body.query.trim() === "") {
      return new Response(
        JSON.stringify({ success: false, error: "query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const limit = Math.min(body.limit ?? 5, 10);
    const userQuery = body.query.trim();
    const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY");

    if (!googleKey) {
      return new Response(
        JSON.stringify({ success: false, error: "GOOGLE_PLACES_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let results: EnrichedPlace[];
    try {
      results = await searchWithGooglePlaces(userQuery, limit, googleKey);
      console.log("[search-places] Google returned", results.length, "results");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google Places search error";
      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, results }),
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
