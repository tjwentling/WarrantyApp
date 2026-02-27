/**
 * UPC Product Lookup
 * Uses multiple free APIs to find product info from a barcode scan.
 *
 * Priority order:
 * 1. Open Food Facts — best for food & grocery items (completely free, no key)
 * 2. UPC Item DB — general products (free trial tier, no key required)
 * 3. Open Product Data — fallback
 */

export interface ProductInfo {
  name: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  upc: string;
}

/** Map external category strings to our app's Category type */
function mapCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (r.includes('electronic') || r.includes('computer') || r.includes('phone') || r.includes('tablet') || r.includes('camera')) return 'Electronics';
  if (r.includes('appliance') || r.includes('kitchen') || r.includes('home')) return 'Appliances';
  if (r.includes('vehicle') || r.includes('auto') || r.includes('car') || r.includes('tire')) return 'Vehicles';
  if (r.includes('furniture') || r.includes('chair') || r.includes('table') || r.includes('bed')) return 'Furniture';
  if (r.includes('toy') || r.includes('game') || r.includes('baby')) return 'Toys';
  if (r.includes('food') || r.includes('beverage') || r.includes('drink') || r.includes('snack') || r.includes('grocery')) return 'Food & Beverage';
  if (r.includes('medical') || r.includes('health') || r.includes('pharmacy') || r.includes('drug')) return 'Medical Devices';
  if (r.includes('cloth') || r.includes('apparel') || r.includes('shoe') || r.includes('fashion')) return 'Clothing & Accessories';
  if (r.includes('tool') || r.includes('hardware') || r.includes('garden') || r.includes('power')) return 'Tools & Equipment';
  return 'Other';
}

/** Try Open Food Facts first (best for food UPCs) */
async function tryOpenFoodFacts(upc: string): Promise<ProductInfo | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${upc}.json`, {
      headers: { 'User-Agent': 'WarrantyApp/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    return {
      name: p.product_name || p.product_name_en || null,
      brand: p.brands?.split(',')[0]?.trim() || null,
      model: null,
      category: 'Food & Beverage',
      description: p.generic_name || null,
      imageUrl: p.image_front_url || p.image_url || null,
      upc,
    };
  } catch {
    return null;
  }
}

/** Try UPC Item DB (general merchandise) */
async function tryUPCItemDB(upc: string): Promise<ProductInfo | null> {
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`, {
      headers: { 'User-Agent': 'WarrantyApp/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) return null;
    return {
      name: item.title || null,
      brand: item.brand || null,
      model: item.model || null,
      category: mapCategory(item.category),
      description: item.description || null,
      imageUrl: item.images?.[0] || null,
      upc,
    };
  } catch {
    return null;
  }
}

/** Try Open Product Data */
async function tryOpenProductData(upc: string): Promise<ProductInfo | null> {
  try {
    const res = await fetch(`https://api.opengtindb.org/?ean=${upc}&cmd=product&lang=en`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.product?.name) return null;
    return {
      name: data.product.name || null,
      brand: data.product.vendor || null,
      model: null,
      category: mapCategory(data.product.maincat),
      description: data.product.description || null,
      imageUrl: null,
      upc,
    };
  } catch {
    return null;
  }
}

/**
 * Look up a product by UPC/EAN barcode.
 * Tries multiple APIs and returns the first successful result.
 */
export async function lookupUPC(upc: string): Promise<ProductInfo | null> {
  // Try all sources in priority order
  const result =
    await tryOpenFoodFacts(upc) ||
    await tryUPCItemDB(upc) ||
    await tryOpenProductData(upc);

  return result;
}
