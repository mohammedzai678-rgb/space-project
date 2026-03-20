import { handleOptions, sendJson } from "./_lib/http.js";

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`NASA request failed with status ${response.status}.`);
  }

  return response.json();
}

export default async function handler(req, res) {
  if (handleOptions(req, res, ["GET", "OPTIONS"])) {
    return;
  }

  try {
    if (req.method !== "GET") {
      sendJson(res, 405, {
        ok: false,
        error: "Method Not Allowed"
      }, {
        Allow: "GET, OPTIONS"
      });
      return;
    }

    const apiKey = process.env.NASA_API_KEY || "DEMO_KEY";
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 2);

    const [apod, neoFeed] = await Promise.all([
      fetchJson(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(apiKey)}`),
      fetchJson(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&api_key=${encodeURIComponent(apiKey)}`)
    ]);

    const nearEarthObjects = Object.values(neoFeed.near_earth_objects || {})
      .flat()
      .map((item) => {
        const approach = item.close_approach_data?.[0] || {};
        return {
          id: item.id,
          name: item.name,
          hazardous: Boolean(item.is_potentially_hazardous_asteroid),
          closeApproachDate: approach.close_approach_date || "Unknown",
          velocityKph: Number(approach.relative_velocity?.kilometers_per_hour || 0).toFixed(0),
          missDistanceKm: Number(approach.miss_distance?.kilometers || 0).toFixed(0),
          diameterMaxKm: Number(item.estimated_diameter?.kilometers?.estimated_diameter_max || 0).toFixed(3),
          nasaUrl: item.nasa_jpl_url
        };
      })
      .sort((left, right) => Number(left.missDistanceKm) - Number(right.missDistanceKm))
      .slice(0, 8);

    sendJson(res, 200, {
      ok: true,
      apod: {
        title: apod.title,
        date: apod.date,
        explanation: apod.explanation,
        imageUrl: apod.media_type === "image" ? apod.url : "",
        mediaType: apod.media_type
      },
      nearEarthObjects
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "NASA endpoint failed."
    });
  }
}
