import { createApi } from "unsplash-js";
import logger from "../config/logger";

export interface VenueImagesPayload {
  primary: string | null;
  gallery: string[];
}

const SPORT_QUERY_MAP: Record<string, string> = {
  cricket: "cricket turf",
  football: "football turf",
  pickleball: "pickleball court",
 
};

const IMAGE_TARGET_COUNT = 5;
let hasLoggedMissingAccessKey = false;

const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();

const unsplash = accessKey
  ? createApi({
      accessKey,
      fetch: globalThis.fetch.bind(globalThis),
    })
  : null;

const normalizeSportType = (sportType: string | null | undefined) =>
  sportType?.trim().toLowerCase() ?? "";

const getSearchQuery = (sportType: string | null | undefined) => {
  const normalizedSportType = normalizeSportType(sportType);
  return SPORT_QUERY_MAP[normalizedSportType] ?? "sports venue";
};

const buildEmptyVenueImages = (): VenueImagesPayload => ({
  primary: null,
  gallery: [],
});

const getVenueImages = async (
  sportType: string | null | undefined
): Promise<VenueImagesPayload> => {
  if (!unsplash) {
    if (!hasLoggedMissingAccessKey) {
      logger.warn(
        "UNSPLASH_ACCESS_KEY is not configured. Venue image requests will use existing cached images or frontend fallbacks."
      );
      hasLoggedMissingAccessKey = true;
    }

    return buildEmptyVenueImages();
  }

  try {
    const response = await unsplash.search.getPhotos({
      query: getSearchQuery(sportType),
      page: 1,
      perPage: 10,
      orientation: "landscape",
      contentFilter: "high",
    });

    if (response.type !== "success") {
      logger.warn("Unsplash image search did not succeed", {
        sportType,
        errors: response.errors,
      });
      return buildEmptyVenueImages();
    }

    const uniqueImages = [
      ...new Set(
        response.response.results
          .map((photo) => photo.urls.regular)
          .filter((url): url is string => Boolean(url && url.trim() !== ""))
      ),
    ].slice(0, IMAGE_TARGET_COUNT);

    if (uniqueImages.length === 0) {
      return buildEmptyVenueImages();
    }

    return {
      primary: uniqueImages[0] ?? null,
      gallery: uniqueImages.slice(1, IMAGE_TARGET_COUNT),
    };
  } catch (error: unknown) {
    logger.error("Failed to fetch venue images from Unsplash", {
      sportType,
      error,
    });
    return buildEmptyVenueImages();
  }
};

export default {
  getVenueImages,
};
