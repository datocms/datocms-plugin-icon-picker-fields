import { RenderConfigScreenCtx } from 'datocms-plugin-sdk';
import { Button, Canvas } from 'datocms-react-ui';
import { useState } from 'react';
import { migrateParametersToAssets } from '../lib/assetManager';

type PropTypes = {
  ctx: RenderConfigScreenCtx;
  onMigrationComplete: () => void;
};

type MigrationState = 'ready' | 'migrating' | 'completed' | 'error' | 'permission_error';

export default function MigrationWizard({ ctx, onMigrationComplete }: PropTypes) {
  const [state, setState] = useState<MigrationState>('ready');
  const [error, setError] = useState<string | null>(null);

  const hasLegacyData = () => {
    const params = ctx.plugin.attributes.parameters;
    return (
      params.icons &&
      params.filters &&
      params.styles &&
      !params.iconsAssetId &&
      !params.filtersAssetId &&
      !params.stylesAssetId
    );
  };

  const handleMigration = async () => {
    setState('migrating');
    setError(null);

    try {
      const params = ctx.plugin.attributes.parameters;

      // Migrate the data to assets
      const { iconsAssetId, filtersAssetId, stylesAssetId } =
        await migrateParametersToAssets(
          ctx,
          params.icons as string,
          params.filters as string,
          params.styles as string
        );

      // Update plugin parameters with asset IDs and remove old data
      await ctx.updatePluginParameters({
        generalOptions: params.generalOptions, // Keep general options
        iconsAssetId,
        filtersAssetId,
        stylesAssetId,
        migratedToAssets: true,
        // Remove legacy fields
        icons: undefined,
        filters: undefined,
        styles: undefined,
      });

      setState('completed');
      ctx.notice('Migration completed successfully!');

      // Notify parent to refresh the view
      setTimeout(() => {
        onMigrationComplete();
      }, 2000);
    } catch (err) {
      console.error('Migration error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';

      // Check if this is a permission error (401 or INVALID_AUTHORIZATION_HEADER)
      const isPermissionError = errorMessage.includes('401') ||
        errorMessage.includes('INVALID_AUTHORIZATION_HEADER') ||
        errorMessage.includes('upload-requests');

      if (isPermissionError) {
        setState('permission_error');
        ctx.alert('Migration failed: the plugin needs permission to manage uploads.');
      } else {
        setState('error');
        setError(errorMessage);
        ctx.alert('Migration failed. Please try again or contact support.');
      }
    }
  };

  if (!hasLegacyData()) {
    return null;
  }

  return (
    <Canvas ctx={ctx}>
      <div style={{ padding: '20px' }}>
        <h2 style={{ marginTop: 0 }}>Migration Required</h2>

        {state === 'ready' && (
          <>
            <p>
              <strong>Welcome to Icon Font Picker v2.0!</strong>
            </p>
            <p>
              This version stores icon data, filters, and styles as DatoCMS assets
              instead of in plugin parameters. This provides better performance and
              makes it easier to manage large icon sets.
            </p>
            <p>
              Your existing configuration will be automatically converted to assets.
              This process will:
            </p>
            <ul>
              <li>Create three new assets: icons, filters, and styles</li>
              <li>Preserve all your current settings</li>
              <li>Remove the old configuration data from plugin parameters</li>
            </ul>
            <p>
              <strong>Note:</strong> This is a one-time migration and cannot be undone.
              Your general options (like iconPrefix) will remain in plugin settings.
            </p>
            <Button
              type="button"
              buttonSize="l"
              buttonType="primary"
              onClick={handleMigration}
            >
              Start Migration
            </Button>
          </>
        )}

        {state === 'migrating' && (
          <div>
            <p>
              <strong>Migrating your data...</strong>
            </p>
            <p>
              Please wait while we create the assets and update your configuration.
              This may take a few moments.
            </p>
          </div>
        )}

        {state === 'completed' && (
          <div>
            <p style={{ color: 'green' }}>
              <strong>Migration completed successfully!</strong>
            </p>
            <p>
              Your icon data, filters, and styles are now stored as assets.
              The page will refresh automatically.
            </p>
          </div>
        )}

        {state === 'permission_error' && (
          <div>
            <p style={{ color: 'red' }}>
              <strong>Permission Required</strong>
            </p>
            <p>
              The migration failed because this plugin doesn't have the required API access permission.
              To fix this, you need to enable the <strong>currentUserAccessToken</strong> permission for this plugin.
            </p>
            <Button
              type="button"
              buttonSize="m"
              buttonType="primary"
              onClick={() => setState('ready')}
            >
              Try Again
            </Button>
          </div>
        )}

        {state === 'error' && (
          <div>
            <p style={{ color: 'red' }}>
              <strong>Migration failed</strong>
            </p>
            <p>{error}</p>
            <p>
              Please try again. If the problem persists, contact support.
            </p>
            <Button
              type="button"
              buttonSize="m"
              buttonType="primary"
              onClick={() => setState('ready')}
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </Canvas>
  );
}
