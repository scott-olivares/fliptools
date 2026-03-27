import { Router } from "express";

interface PhotonFeature {
  type: "Feature";
  properties: {
    osm_id?: number;
    housenumber?: string;
    street?: string;
    name?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    countrycode?: string;
    type?: string;
  };
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface PhotonResponse {
  type: "FeatureCollection";
  features: PhotonFeature[];
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

function toSuggestion(f: PhotonFeature, idx: number): AddressSuggestion {
  const p = f.properties;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const city = p.city || p.town || p.village || "";
  const state = p.state || "";
  const zip = p.postcode || "";
  const parts = [street, city, state, zip].filter(Boolean);
  const display_name = parts.join(", ");

  return {
    place_id: String(p.osm_id ?? idx),
    display_name,
    address: {
      house_number: p.housenumber,
      road: p.street,
      city,
      state,
      postcode: p.postcode,
      country_code: p.countrycode?.toLowerCase(),
    },
  };
}

const router = Router();

router.get("/geocode/autocomplete", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 5) {
    res.json([]);
    return;
  }

  try {
    const params = new URLSearchParams({
      q,
      limit: "8",
      lang: "en",
      bbox: "-124.78,24.74,-66.95,49.34",
    });

    const response = await fetch(
      `https://photon.komoot.io/api/?${params}`,
      {
        headers: {
          "User-Agent": "DealAnalyzerApp/1.0 (realestate@example.com)",
        },
      }
    );

    if (!response.ok) {
      res.status(502).json({ error: "Geocoding service unavailable" });
      return;
    }

    const data: PhotonResponse = await response.json();
    const suggestions: AddressSuggestion[] = data.features
      .filter(f => f.properties.countrycode?.toLowerCase() === "us")
      .filter(f => f.properties.street || f.properties.housenumber)
      .map(toSuggestion)
      .slice(0, 5);

    res.json(suggestions);
  } catch (err) {
    res.status(502).json({ error: "Geocoding request failed" });
  }
});

export default router;
