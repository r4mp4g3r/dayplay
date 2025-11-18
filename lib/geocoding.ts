/**
 * Geocoding utilities to convert addresses/postal codes to coordinates
 */

const GOOGLE_GEOCODING_API_KEY = 
  process.env.GOOGLE_PLACES_API_KEY || 
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  city?: string;
}

/**
 * Convert postal code or address to coordinates using Google Geocoding API
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!GOOGLE_GEOCODING_API_KEY) {
    console.warn('Google API key not configured for geocoding');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${GOOGLE_GEOCODING_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      const location = result.geometry.location;

      // Extract city from address components
      const cityComponent = result.address_components.find(
        (component: any) =>
          component.types.includes('locality') ||
          component.types.includes('administrative_area_level_2')
      );

      return {
        latitude: location.lat,
        longitude: location.lng,
        formattedAddress: result.formatted_address,
        city: cityComponent?.long_name,
      };
    }

    console.error('Geocoding failed:', data.status);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Validate postal code format (basic check)
 */
export function isValidPostalCode(postalCode: string): boolean {
  // Remove spaces and hyphens
  const cleaned = postalCode.replace(/[\s-]/g, '');
  
  // US ZIP code (5 or 9 digits)
  const usZipRegex = /^\d{5}(\d{4})?$/;
  
  // Canadian postal code (A1A 1A1 format)
  const canadaPostalRegex = /^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/;
  
  // UK postcode (basic pattern)
  const ukPostcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\d[A-Z]{2}$/i;
  
  return (
    usZipRegex.test(cleaned) ||
    canadaPostalRegex.test(cleaned) ||
    ukPostcodeRegex.test(cleaned)
  );
}

/**
 * Fallback geocoding without API key (uses free service)
 * Note: Rate limited, use Google API for production
 */
export async function geocodeAddressFallback(address: string): Promise<GeocodingResult | null> {
  try {
    // Using Nominatim (OpenStreetMap's geocoding service)
    // Free but rate-limited to 1 request per second
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address
    )}&limit=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SwipelyApp/1.0', // Required by Nominatim
      },
    });

    const data = await response.json();

    if (data.length > 0) {
      const result = data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        formattedAddress: result.display_name,
        city: result.address?.city || result.address?.town || result.address?.village,
      };
    }

    return null;
  } catch (error) {
    console.error('Fallback geocoding error:', error);
    return null;
  }
}

