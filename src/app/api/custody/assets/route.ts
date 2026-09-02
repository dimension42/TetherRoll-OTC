import { handleApiError } from '@/lib/auth/guards';
import { getEnabledAssets, toPublicAsset } from '@/lib/custody/assets';

export const dynamic = 'force-dynamic';

/**
 * GET /api/custody/assets
 * Public endpoint — returns enabled custody assets without deposit addresses.
 */
export async function GET() {
  try {
    const assets = await getEnabledAssets();
    const publicAssets = assets.map(toPublicAsset);
    return Response.json({ assets: publicAssets });
  } catch (e) {
    return handleApiError(e);
  }
}
