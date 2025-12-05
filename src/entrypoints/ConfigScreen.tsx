import { RenderConfigScreenCtx } from 'datocms-plugin-sdk';
import {
  Button,
  Canvas,
  Form,
  FieldGroup,
} from 'datocms-react-ui';
import { useState, useCallback, useEffect } from 'react';
import { Form as FormHandler } from 'react-final-form';
import JsonTextarea from '../components/JsonTextarea';
import MigrationWizard from '../components/MigrationWizard';
import { validateArray, validateGeneralOptions } from '../lib/validators';
import { createAssetFromContent, fetchAssetContent, assetExists, ASSET_NAMES } from '../lib/assetManager';
import s from '../lib/styles.module.css';

type PropTypes = {
  ctx: RenderConfigScreenCtx;
};

type LegacyParameters = {
  filters?: string;
  generalOptions?: string;
  icons?: string;
  styles?: string;
};

type AssetParameters = {
  generalOptions?: string;
  iconsAssetId?: string;
  filtersAssetId?: string;
  stylesAssetId?: string;
  migratedToAssets?: boolean;
};

type Parameters = LegacyParameters & AssetParameters;

type State = {
  parameters: Parameters;
  valid: boolean;
  showMigration: boolean;
  loading: boolean;
  assetContents: {
    icons: string;
    filters: string;
    styles: string;
  };
};

const defaultAssetContents = {
  icons: "[]",
  filters: "[]",
  styles: "",
};

const defaultGeneralOptions = `{
  "iconPrefix": ""
}`;

export default function ConfigScreen({ ctx }: PropTypes) {
  const [state, setState] = useState<State>({
		parameters: ctx.plugin.attributes.parameters as Parameters,
		valid: false,
    showMigration: false,
    loading: true,
    assetContents: defaultAssetContents,
	});

  // Check if we need to show migration or load asset contents
  useEffect(() => {
    const initializeScreen = async () => {
      const params = ctx.plugin.attributes.parameters as Parameters;

      // Check if we have legacy data that needs migration
      const hasLegacyData = params.icons && params.filters && params.styles &&
        !params.iconsAssetId && !params.filtersAssetId && !params.stylesAssetId;

      if (hasLegacyData) {
        setState(current => ({
          ...current,
          showMigration: true,
          loading: false,
        }));
        return;
      }

      // If we have asset IDs, check if they still exist and load their contents
      if (params.iconsAssetId && params.filtersAssetId && params.stylesAssetId) {
        try {
          // First check if all assets still exist (they may have been deleted/cancelled)
          const [iconsExists, filtersExists, stylesExists] = await Promise.all([
            assetExists(ctx, params.iconsAssetId),
            assetExists(ctx, params.filtersAssetId),
            assetExists(ctx, params.stylesAssetId),
          ]);

          const anyAssetMissing = !iconsExists || !filtersExists || !stylesExists;

          if (anyAssetMissing) {
            // Assets have been deleted, regenerate them with defaults
            console.warn('Configuration assets were deleted, regenerating with defaults...');
            ctx.notice('Configuration assets were deleted. Regenerating with default values...');

            const [iconsAssetId, filtersAssetId, stylesAssetId] = await Promise.all([
              createAssetFromContent(ctx, defaultAssetContents.icons, ASSET_NAMES.ICONS, 'application/json'),
              createAssetFromContent(ctx, defaultAssetContents.filters, ASSET_NAMES.FILTERS, 'application/json'),
              createAssetFromContent(ctx, defaultAssetContents.styles, ASSET_NAMES.STYLES, 'text/css'),
            ]);

            // Update plugin parameters with new asset IDs
            await ctx.updatePluginParameters({
              generalOptions: params.generalOptions || defaultGeneralOptions,
              iconsAssetId,
              filtersAssetId,
              stylesAssetId,
              migratedToAssets: true,
            });

            setState(current => ({
              ...current,
              parameters: {
                ...current.parameters,
                iconsAssetId,
                filtersAssetId,
                stylesAssetId,
              },
              assetContents: defaultAssetContents,
              loading: false,
            }));
            return;
          }

          // Assets exist, load their contents
          const [iconsContent, filtersContent, stylesContent] = await Promise.all([
            fetchAssetContent(ctx, params.iconsAssetId),
            fetchAssetContent(ctx, params.filtersAssetId),
            fetchAssetContent(ctx, params.stylesAssetId),
          ]);

          setState(current => ({
            ...current,
            assetContents: {
              icons: iconsContent,
              filters: filtersContent,
              styles: stylesContent,
            },
            loading: false,
          }));
        } catch (error) {
          console.error('Failed to load asset contents:', error);
          ctx.alert('Failed to load configuration assets. Please try refreshing the page.');
          setState(current => ({ ...current, loading: false }));
        }
      } else {
        // No data at all, use defaults
        setState(current => ({ ...current, loading: false }));
      }
    };

    initializeScreen();
  }, [ctx]);

  const handleMigrationComplete = useCallback(() => {
    // Reload the page to refresh the config screen
    window.location.reload();
  }, []);

	const handleOnChange = useCallback((partialContents: Partial<typeof defaultAssetContents>) => {
		setState((current) => ({
      ...current,
			valid: true,
			assetContents: {
        ...current.assetContents,
				...partialContents,
			},
		}));
	}, []);

  const handleGeneralOptionsChange = useCallback((value: string) => {
    setState((current) => ({
      ...current,
      valid: true,
      parameters: {
        ...current.parameters,
        generalOptions: value,
      },
    }));
  }, []);

	const handleOnError = useCallback(() => {
		setState(current => ({
			...current,
			valid: false,
		}));
	}, []);

  // Show migration wizard if needed
  if (state.showMigration) {
    return <MigrationWizard ctx={ctx} onMigrationComplete={handleMigrationComplete} />;
  }

  // Show loading state
  if (state.loading) {
    return (
      <Canvas ctx={ctx}>
        <div style={{ padding: '20px' }}>
          <p>Loading configuration...</p>
        </div>
      </Canvas>
    );
  }

  return (
    <Canvas ctx={ctx}>
      <FormHandler<Parameters>
        initialValues={ctx.plugin.attributes.parameters}
        onSubmit={async () => {
          try {
            const params = state.parameters;

            // Create new assets with updated content
            const [iconsAssetId, filtersAssetId, stylesAssetId] = await Promise.all([
              createAssetFromContent(ctx, state.assetContents.icons, ASSET_NAMES.ICONS, 'application/json'),
              createAssetFromContent(ctx, state.assetContents.filters, ASSET_NAMES.FILTERS, 'application/json'),
              createAssetFromContent(ctx, state.assetContents.styles, ASSET_NAMES.STYLES, 'text/css'),
            ]);

            // Update plugin parameters with new asset IDs
            await ctx.updatePluginParameters({
              generalOptions: params.generalOptions || defaultGeneralOptions,
              iconsAssetId,
              filtersAssetId,
              stylesAssetId,
              migratedToAssets: true,
            });

            setState(current => ({
              ...current,
              valid: false,
              parameters: {
                ...current.parameters,
                iconsAssetId,
                filtersAssetId,
                stylesAssetId,
              },
            }));

            ctx.notice('Settings updated successfully!');
          } catch (error) {
            console.error('Failed to save settings:', error);
            ctx.alert('Failed to save settings. Please try again.');
          }
        }}
      >
        {({ handleSubmit, submitting }) => (
          <Form onSubmit={handleSubmit}>
            <FieldGroup>
              <>
                <label className={s["form-label"]}>General Options</label>
                <JsonTextarea
                  label="General Options"
                  initialValue={state.parameters.generalOptions || defaultGeneralOptions}
                  validate={validateGeneralOptions}
                  onValidChange={(value) => handleGeneralOptionsChange(value)}
                  onError={handleOnError}
                />

                <label className={s["form-label"]}>Icon names</label>
                <JsonTextarea
                  label="Icon Names"
                  initialValue={state.assetContents.icons}
                  validate={validateArray}
                  onValidChange={(value) => handleOnChange({ icons: value})}
                  onError={handleOnError}
                />

                <label className={s["form-label"]}>Filters</label>
                <JsonTextarea
                  label="Filters"
                  initialValue={state.assetContents.filters}
                  validate={validateArray}
                  onValidChange={(value) => handleOnChange({ filters: value})}
                  onError={handleOnError}
                />

                <label className={s["form-label"]}>CSS Styles</label>
                <textarea
                  className={s["form-textarea"]}
                  placeholder="Insert CSS styles here"
                  value={state.assetContents.styles}
                  onChange={(e) => handleOnChange({ styles: e.target.value})}
                  required
                  spellCheck={false}
                  autoCapitalize="off"
                />
              </>
            </FieldGroup>
            <Button
              type="submit"
              fullWidth
              buttonSize="l"
              buttonType="primary"
              disabled={submitting || !state.valid}
            >
              Save settings
            </Button>
          </Form>
        )}
      </FormHandler>
    </Canvas>
  );
}
