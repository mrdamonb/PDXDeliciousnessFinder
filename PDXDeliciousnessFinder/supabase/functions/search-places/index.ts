import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function searchWithYelp(query: string, limit: number, apiKey: string): Promise<EnrichedPlace[]> {
  const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(query)}&location=Portland%2C+OR&limit=${limit}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  const text = await resp.text();
  console.log("[search-places] Yelp status:", resp.status, "body:", text.slice(0, 300));
  if (!resp.ok) throw new Error(`Yelp HTTP ${resp.status}: ${text}`);

  const json = JSON.parse(text);
  const businesses: Array<Record<string, unknown>> = json?.businesses ?? [];
  if (!Array.isArray(businesses)) return [];

  return businesses.map((b) => {
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
    const yelpKey = Deno.env.get("YELP_API_KEY");

    if (!yelpKey) {
      return new Response(
        JSON.stringify({ success: false, error: "YELP_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let results: EnrichedPlace[];
    try {
      results = await searchWithYelp(userQuery, limit, yelpKey);
      console.log("[search-places] Yelp returned", results.length, "results");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Yelp search error";
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
