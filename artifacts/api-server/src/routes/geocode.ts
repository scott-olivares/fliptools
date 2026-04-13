import { Router } from "express";

/**
 * Address autocomplete — backed by Google Places API.
 *
 * Requires env var: GOOGLE_PLACES_API_KEY
 *
 * This endpoint proxies Google's Place Autocomplete API so the API key
 * stays server-side and is never exposed to the browser.
 *
 * Google Places API docs:
 * https://developers.google.com/maps/documentation/places/web-service/autocomplete
 */

interface GooglePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  terms: { offset: number; value: string }[];
}

interface GoogleAutocompleteResponse {
  status: string;
  predictions: GooglePrediction[];
  error_message?: string;
}

interface AddressSuggestion {
  place_id: string;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
  };
}

function parsePrediction(p: GooglePrediction): AddressSuggestion {
  // description is the full formatted address e.g.
  // "15438 La Subida Dr, Hacienda Heights, CA 91745, USA"
  const display = p.description.replace(/, USA$/, "").trim();

  // Parse components from terms array: [number+street, city, state+zip, country]
  const terms = p.terms.map((t) => t.value);
  const street = terms[0] ?? "";
  const city = terms[1] ?? "";
  const stateZip = terms[2] ?? ""; // e.g. "CA 91745" or "CA"
  const [state, postcode] = stateZip.split(" ");

  // Split street into house number and road
  const streetMatch = street.match(/^(\d+)\s+(.+)$/);
  const house_number = streetMatch?.[1];
  const road = streetMatch?.[2] ?? street;

  return {
    place_id: p.place_id,
    display_name: display,
    address: {
      house_number,
      road,
      city,
      state,
      postcode,
      country_code: "us",
    },
  };
}

const router = Router();

router.get("/geocode/autocomplete", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 3) {
    res.json([]);
    return;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Google Places API key not configured" });
    return;
  }

  try {
    const params = new URLSearchParams({
      input: q,
      key: apiKey,
      types: "address",
      components: "country:us", // US addresses only
      language: "en",
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
    );

    if (!response.ok) {
      res.status(502).json({ error: "Google Places API unavailable" });
      return;
    }

    const data = (await response.json()) as GoogleAutocompleteResponse;

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Google Places API error",
          status: data.status,
          error_message: data.error_message,
          timestamp: new Date().toISOString(),
        }),
      );
      res.status(502).json({ error: `Google Places error: ${data.status}` });
      return;
    }

    const suggestions: AddressSuggestion[] = (data.predictions ?? [])
      .slice(0, 5)
      .map(parsePrediction);

    res.json(suggestions);
  } catch (err: any) {
    res.status(502).json({ error: "Geocoding request failed" });
  }
});

export default router;
