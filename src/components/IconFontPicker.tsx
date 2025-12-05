import { RenderFieldExtensionCtx } from "datocms-plugin-sdk";
import { FC, ReactNode, useState, useEffect } from "react";
import get from "lodash/get";
import "./styles.css";
import { Canvas, TextInput } from "datocms-react-ui";
import { fetchAssetContent, assetExists } from "../lib/assetManager";

const arrowIcon = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/PjxzdmcgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDQ4IDQ4IiB3aWR0aD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTIwIDEybC0yLjgzIDIuODMgOS4xNyA5LjE3LTkuMTcgOS4xNyAyLjgzIDIuODMgMTItMTJ6Ii8+PHBhdGggZD0iTTAgMGg0OHY0OGgtNDh6IiBmaWxsPSJub25lIi8+PC9zdmc+";
const doubleArrowIcon = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/PjxzdmcgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDQ4IDQ4IiB3aWR0aD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDM2bDE3LTEyLTE3LTEydjI0em0yMC0yNHYyNGg0VjEyaC00eiIvPjxwYXRoIGQ9Ik0wIDBoNDh2NDhIMHoiIGZpbGw9Im5vbmUiLz48L3N2Zz4=";

type Props = {
  ctx: RenderFieldExtensionCtx;
};

type ConfigFilter = {
  name: string;
  value: string;
};

type GeneralOptions = {
  iconPrefix: string;
};

interface ConfigSettings {
  filters: ConfigFilter[];
  generalOptions: GeneralOptions;
  icons: string[];
  styles: string;
};

const IconFontPicker: FC<Props> = ({ ctx }) => {
  const initialValue = get(ctx?.formValues, ctx?.fieldPath || "");
  const [showIcons, setShowIcons] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIcon, setSelectedIcon] = useState(
    typeof initialValue === "string" ? JSON.parse(initialValue) : null
  );
  const [configSettings, setConfigSettings] = useState<ConfigSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load configuration from assets
  useEffect(() => {
    const loadConfiguration = async () => {
      try {
        const params = ctx.plugin.attributes.parameters;

        // Check if we have asset IDs (v2.0)
        if (params.iconsAssetId && params.filtersAssetId && params.stylesAssetId) {
          // First verify the assets still exist (they may have been deleted/cancelled)
          const [iconsExists, filtersExists, stylesExists] = await Promise.all([
            assetExists(ctx, params.iconsAssetId as string),
            assetExists(ctx, params.filtersAssetId as string),
            assetExists(ctx, params.stylesAssetId as string),
          ]);

          if (!iconsExists || !filtersExists || !stylesExists) {
            setError('Configuration assets were deleted. Please visit the plugin settings to regenerate them.');
            setLoading(false);
            return;
          }

          const [iconsContent, filtersContent, stylesContent] = await Promise.all([
            fetchAssetContent(ctx, params.iconsAssetId as string),
            fetchAssetContent(ctx, params.filtersAssetId as string),
            fetchAssetContent(ctx, params.stylesAssetId as string),
          ]);

          const generalOptions = params.generalOptions
            ? JSON.parse(params.generalOptions as string)
            : { iconPrefix: "" };

          setConfigSettings({
            icons: JSON.parse(iconsContent),
            filters: JSON.parse(filtersContent),
            styles: stylesContent,
            generalOptions,
          });
        }
        // Fallback to legacy parameters (v1.x) - shouldn't happen after migration
        else if (params.icons && params.filters && params.styles) {
          setConfigSettings({
            filters: JSON.parse(params.filters as string) as ConfigFilter[],
            styles: params.styles as string || "",
            icons: JSON.parse(params.icons as string) as string[],
            generalOptions: JSON.parse(params.generalOptions as string) as GeneralOptions,
          });
        } else {
          setError('Configuration not found. Please configure the plugin in settings.');
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to load configuration:', err);
        setError('Failed to load configuration. Please check plugin settings.');
        setLoading(false);
      }
    };

    loadConfiguration();
  }, [ctx]);

  if (loading) {
    return (
      <Canvas ctx={ctx}>
        <div style={{ padding: '20px' }}>
          <p>Loading configuration...</p>
        </div>
      </Canvas>
    );
  }

  if (error || !configSettings) {
    return (
      <Canvas ctx={ctx}>
        <div style={{ padding: '20px', color: 'red' }}>
          <p>{error || 'Configuration error'}</p>
        </div>
      </Canvas>
    );
  }

  const iconPrefix = configSettings.generalOptions.iconPrefix || "";

  const handleIconClick = (icon: string) => {
    setSelectedIcon({ icon: icon });
    ctx?.setFieldValue(ctx.fieldPath, icon ? JSON.stringify({ "icon": icon }) : "");
    setShowIcons(false);
  };

  const handleFilterChange = (value: string) => {
    let filters = [...activeFilters];

    if (activeFilters.includes(value)) {
      filters = filters.filter(x => x !== value);
    } else {
      filters.push(value);
    }

    setCurrentPage(1);
    setActiveFilters(filters);
  };

  const multiSearchAnd = (text: string) => {
    return activeFilters?.every((el) => text.match(new RegExp(el, "i")));
  };

  const allIcons = [...configSettings.icons]
    .filter((icon) => multiSearchAnd(icon))
    .filter((icon) => {
      if (searchTerm) {
        return icon.indexOf(searchTerm.toLowerCase()) !== -1;
      } else {
        return icon;
      }
    })
    .sort((a, b) => {
      if (a > b) {
        return 1;
      } else if (a < b) {
        return -1;
      }
      return 0;
    });

  const pageSize = 36;
  const workingIcons = [...allIcons].slice(
    (currentPage - 1) * pageSize,
    (currentPage - 1) * pageSize + pageSize
  );
  const totalPages = Math.ceil(allIcons.length / pageSize);

  const filters: ReactNode | undefined = configSettings.filters?.length && (
    <div className="filters">
      {configSettings.filters.map((x, index) => (
        <label key={`${x.value}_${index}`}>
          <input
            type="checkbox"
            value={x.value}
            checked={activeFilters.includes(x.value)}
            onChange={() => handleFilterChange(x.value)}
            />
          <span>{x.name}</span>
        </label>
      ))}
    </div>
  );

  return (
    <Canvas ctx={ctx}>
      <style>{configSettings.styles}</style>
      <div className="App">
        {!selectedIcon && (
          <>
            <div>
              <span
                className={`toggler ${showIcons ? "open" : "closed"}`}
                onClick={() => setShowIcons((s) => !s)}
              >
                {showIcons ? "Hide" : "Show"} all icons...
              </span>
            </div>
            <div className="toolbar">
              <div className="row">
                {!!showIcons && (
                  <div className="search-input-wrapper">
                    <TextInput
                      value={searchTerm}
                      autoFocus={false}
                      onChange={(newValue) => {
                        setCurrentPage(1);
                        setSearchTerm(newValue);
                      }}
                      placeholder="Search..."
                      type="search"
                    />
                  </div>
                )}
                {!selectedIcon && !!showIcons && (
                  <div className="pagination">
                    <div>
                      Page {currentPage} of {totalPages === 0 ? 1 : totalPages}
                    </div>
                    <div className="pages">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="btn pagination--first"
                      >
                        <img src={doubleArrowIcon} alt=""/>
                      </button>
                      <button
                        onClick={() => setCurrentPage((s) => s - 1)}
                        disabled={currentPage === 1}
                        className="btn pagination--prev"
                      >
                        <img src={arrowIcon} alt=""/>
                      </button>
                      <button
                        disabled={currentPage === totalPages || totalPages === 0}
                        onClick={() => setCurrentPage((s) => s + 1)}
                        className="btn pagination--next"
                      >
                        <img src={arrowIcon} alt=""/>
                      </button>
                      <button
                        disabled={currentPage === totalPages || totalPages === 0}
                        onClick={() => setCurrentPage(totalPages)}
                        className="btn pagination--last"
                      >
                        <img src={doubleArrowIcon} alt=""/>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {!selectedIcon && !!showIcons && (
                <div className="row filters">
                  {filters}
                </div>
              )}
            </div>
          </>
        )}
        {!!selectedIcon && (
          <div
            className="selected-icon"
            key={`${selectedIcon.icon}`}
          >
            <span className={`icon ${iconPrefix} ${selectedIcon.icon}`} />
            <span>{selectedIcon.icon}</span>
            <div
              onClick={() => {
                ctx?.setFieldValue(ctx.fieldPath, null);
                setSelectedIcon(null);
                setShowIcons(true);
              }}
              className="remove-text"
            >
              Remove
            </div>
          </div>
        )}
        <div className="grid">
          {!selectedIcon &&
            !!showIcons &&
            workingIcons.map((icon) => {
              return (
                <div
                  onClick={() =>
                    handleIconClick(icon)
                  }
                  className="icon"
                  key={icon}
                >
                  <div>
                    <span className={`${iconPrefix} ${icon}`} />
                  </div>
                  <span>{icon}</span>
                </div>
              );
            })}
        </div>
        {!workingIcons.length && <p className="no-result">No icons found.</p>}
      </div>
    </Canvas>
  );
};

export default IconFontPicker;
