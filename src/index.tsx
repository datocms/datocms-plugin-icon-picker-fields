import {
  connect,
  IntentCtx,
  OnBootCtx,
  RenderConfigScreenCtx,
  RenderFieldExtensionCtx,
} from "datocms-plugin-sdk";
import { render } from "./utils/render";
import "datocms-react-ui/styles.css";
import IconFontPicker from "./components/IconFontPicker";
import React from "react";
import ReactDOM from "react-dom";
import ConfigScreen from "./entrypoints/ConfigScreen";

const PLUGIN_NAME = "Icon Font Picker";
const PLUGIN_ID = "icon-picker-fields";

connect({
  renderConfigScreen(ctx: RenderConfigScreenCtx) {
    ReactDOM.render(
      <React.StrictMode>
        <ConfigScreen ctx={ctx} />
      </React.StrictMode>,
      document.getElementById('root'),
    );
  },

  manualFieldExtensions(ctx: IntentCtx) {
    return [
      {
        id: PLUGIN_ID,
        name: PLUGIN_NAME,
        type: "editor",
        fieldTypes: ["json"],
      },
    ];
  },

  renderFieldExtension(fieldExtensionId: string, ctx: RenderFieldExtensionCtx) {
    switch (fieldExtensionId) {
      case PLUGIN_ID:
        return render(<IconFontPicker ctx={ctx} />);
      default:
        return null;
    }
  },
  async onBoot(ctx: OnBootCtx) {
    // Handle legacy plugin migration (from older versions that didn't use fieldExtensionId)
    if (!ctx.plugin.attributes.parameters.migratedFromLegacyPlugin) {
      // if the current user cannot edit fields' settings, skip
      if (ctx.currentRole.meta.final_permissions.can_edit_schema) {
        // get all the fields currently associated to the plugin...
        const fields = await ctx.loadFieldsUsingPlugin();

        // ... and for each of them...
        await Promise.all(
          fields.map(async (field: any) => {
            // set the fieldExtensionId to be the new one
            await ctx.updateFieldAppearance(field.id, [
              {
                operation: "updateEditor",
                newFieldExtensionId: PLUGIN_ID,
              },
            ]);
          })
        );

        // save in configuration the fact that we already performed the migration
        ctx.updatePluginParameters({
          ...ctx.plugin.attributes.parameters,
          migratedFromLegacyPlugin: true,
        });
      }
    }

    // Check if we need to migrate from parameters to assets (v1.x to v2.0)
    const params = ctx.plugin.attributes.parameters;
    const hasLegacyData = params.icons && params.filters && params.styles &&
      !params.iconsAssetId && !params.filtersAssetId && !params.stylesAssetId;

    if (hasLegacyData && ctx.currentRole.meta.final_permissions.can_edit_schema) {
      // Show a notice to the user to migrate
      ctx.notice(
        'Icon Font Picker v2.0 requires migration. Please open plugin settings to migrate your configuration to assets.'
      );
    }
  },
});
