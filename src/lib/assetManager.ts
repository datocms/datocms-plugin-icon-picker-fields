import { buildClient } from '@datocms/cma-client-browser';
import { RenderConfigScreenCtx, RenderFieldExtensionCtx } from 'datocms-plugin-sdk';

// Conventional asset filenames
export const ASSET_NAMES = {
  ICONS: 'icon-picker-fields-icons.json',
  FILTERS: 'icon-picker-fields-filters.json',
  STYLES: 'icon-picker-fields-styles.css',
} as const;

export type AssetType = 'icons' | 'filters' | 'styles';

// Type that accepts both RenderConfigScreenCtx and RenderFieldExtensionCtx
type PluginContext = RenderConfigScreenCtx | RenderFieldExtensionCtx;

/**
 * Create a DatoCMS asset from content string
 */
export async function createAssetFromContent(
  ctx: PluginContext,
  content: string,
  filename: string,
  contentType: string
): Promise<string> {
  const client = buildClient({
    apiToken: ctx.currentUserAccessToken || '',
  });

  // Create a Blob from the content
  const blob = new Blob([content], { type: contentType });

  // Create the upload
  const upload = await client.uploads.createFromFileOrBlob({
    fileOrBlob: blob,
    filename,
  });

  return upload.id;
}

/**
 * Check if an asset exists by upload ID
 * Returns true if the asset exists, false if it has been deleted/cancelled
 */
export async function assetExists(
  ctx: PluginContext,
  uploadId: string
): Promise<boolean> {
  const client = buildClient({
    apiToken: ctx.currentUserAccessToken || '',
  });

  try {
    await client.uploads.find(uploadId);
    return true;
  } catch (error) {
    // Asset not found (deleted/cancelled)
    return false;
  }
}

/**
 * Fetch asset content by upload ID
 */
export async function fetchAssetContent(
  ctx: PluginContext,
  uploadId: string
): Promise<string> {
  const client = buildClient({
    apiToken: ctx.currentUserAccessToken || '',
  });

  const upload = await client.uploads.find(uploadId);

  // Fetch the actual file content from the URL
  const response = await fetch(upload.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch asset content: ${response.statusText}`);
  }

  return await response.text();
}

/**
 * Delete an asset by upload ID
 */
export async function deleteAsset(
  ctx: PluginContext,
  uploadId: string
): Promise<void> {
  const client = buildClient({
    apiToken: ctx.currentUserAccessToken || '',
  });

  await client.uploads.destroy(uploadId);
}

/**
 * Create all three assets from legacy parameters
 */
export async function migrateParametersToAssets(
  ctx: RenderConfigScreenCtx,
  icons: string,
  filters: string,
  styles: string
): Promise<{
  iconsAssetId: string;
  filtersAssetId: string;
  stylesAssetId: string;
}> {
  const [iconsAssetId, filtersAssetId, stylesAssetId] = await Promise.all([
    createAssetFromContent(ctx, icons, ASSET_NAMES.ICONS, 'application/json'),
    createAssetFromContent(ctx, filters, ASSET_NAMES.FILTERS, 'application/json'),
    createAssetFromContent(ctx, styles, ASSET_NAMES.STYLES, 'text/css'),
  ]);

  return {
    iconsAssetId,
    filtersAssetId,
    stylesAssetId,
  };
}
