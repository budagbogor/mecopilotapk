export interface VinData {
  make: string;
  model: string;
  year: string;
  bodyClass: string;
  engine: string;
  fuel: string;
  raw?: any;
}

export const decodeVin = async (vin: string): Promise<VinData | null> => {
  // Basic cleaning
  const cleanVin = vin.trim().toUpperCase();
  
  // Basic validation (VIN is usually 17 chars, but we'll allow flexible length for partial decoding if API supports it)
  if (cleanVin.length < 5) return null;

  try {
    // Using NHTSA Public API (Free, No Key required, CORS friendly usually)
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${cleanVin}?format=json`);
    
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    
    // NHTSA returns an array in 'Results'. We take the first item.
    if (data && data.Results && data.Results.length > 0) {
      const item = data.Results[0];

      // Check if we actually got a valid decode (sometimes it returns success with empty fields)
      if (!item.Make && !item.Model && !item.ModelYear) {
        return null;
      }

      // Construct Engine Description
      const engineParts = [
        item.DisplacementL ? `${item.DisplacementL}L` : '',
        item.EngineCylinders ? `V${item.EngineCylinders}` : '',
        item.FuelTypePrimary || ''
      ].filter(Boolean).join(' ');

      return {
        make: item.Make || '',
        model: item.Model || '',
        year: item.ModelYear || '',
        bodyClass: item.BodyClass || '',
        engine: engineParts,
        fuel: item.FuelTypePrimary || '',
        raw: item
      };
    }
    
    return null;

  } catch (error) {
    console.error("VIN Decode Error:", error);
    return null;
  }
};