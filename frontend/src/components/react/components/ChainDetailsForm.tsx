import { type FormEvent, useEffect, useRef, useState } from "react";

import { Trans, useTranslation } from "react-i18next";
import mapboxgl from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import type * as GeoJSONTypes from "geojson";

import categories from "../util/categories";
import { TextForm } from "./FormFields";
import PopoverOnHover from "./Popover";
import SizesDropdown from "../components/SizesDropdown";
import CategoriesDropdown from "../components/CategoriesDropdown";
import { type RequestRegisterChain } from "../../../api/login";
import { Genders, Sizes } from "../../../api/enums";
import useForm from "../util/form.hooks";
import { addToastError } from "../../../stores/toast";
import { circleRadiusKm } from "../util/maps";
import useLocalizePath from "../util/localize_path.hooks";

const MAPBOX_TOKEN = import.meta.env.PUBLIC_MAPBOX_KEY || "";

interface Props {
  onSubmit: (values: RegisterChainForm) => void;
  initialValues?: RegisterChainForm;
  showBack?: boolean;
  showAllowedTOH: boolean;
  showAllowedDPA: boolean;
  submitText: string;
}

export type RegisterChainForm = Omit<
  RequestRegisterChain,
  "open_to_new_members" | "allow_toh"
>;

type GeoJSONPoint = GeoJSONTypes.FeatureCollection<
  GeoJSONTypes.Geometry,
  { radius: number }
>;

interface Point {
  longitude: number;
  latitude: number;
  radius: number;
}

interface PlaceInfo {
  address: string;
  countryCode: string;
}

function mapToGeoJSON(point: Point | undefined): GeoJSONPoint {
  return {
    type: "FeatureCollection",
    features: point
      ? [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [point.longitude, point.latitude],
            },
            properties: {
              radius: circleRadiusKm((point.radius * 1000) / 6, point.latitude),
            },
          },
        ]
      : [],
  };
}

export default function ChainDetailsForm({
  onSubmit,
  initialValues,
  showBack,
  showAllowedTOH,
  showAllowedDPA,
  submitText,
}: Props) {
  const { t, i18n } = useTranslation();
  const localizePath = useLocalizePath(i18n);

  const mapRef = useRef<any>();
  const [map, setMap] = useState<mapboxgl.Map>();
  const [values, setValue, setValues] = useForm<RegisterChainForm>({
    name: "",
    description: "",
    address: "",
    country_code: "",
    radius: 3,
    genders: [],
    sizes: [],
    longitude: 0,
    latitude: 0,
    ...initialValues,
  });

  useEffect(() => {
    const hasCenter = !!(values.longitude && values.latitude);
    const _map = new mapboxgl.Map({
      accessToken: MAPBOX_TOKEN,
      container: mapRef.current,
      projection: { name: "mercator" },
      zoom: hasCenter ? 10 : 4,
      minZoom: 1,
      maxZoom: 13,
      center: hasCenter
        ? [values.longitude, values.latitude]
        : [4.8998197, 52.3673008],
      style: "mapbox://styles/mapbox/light-v11",
    });
    _map.addControl(new MapboxGeocoder({ accessToken: MAPBOX_TOKEN }));

    _map.on("load", () => {
      _map.addSource("source", {
        type: "geojson",
        data: mapToGeoJSON(
          hasCenter
            ? {
                longitude: values.longitude,
                latitude: values.latitude,
                radius: values.radius,
              }
            : undefined,
        ),
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 30,
      });

      _map.addLayer({
        id: "single",
        type: "circle",
        source: "source",
        paint: {
          "circle-color": ["rgba", 240, 196, 73, 0.4], // #f0c449
          "circle-radius": [
            "interpolate",
            ["exponential", 2],
            ["zoom"],
            0,
            0,
            20,
            ["get", "radius"],
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": ["rgba", 240, 196, 73, 1],
        },
      });

      _map.on("click", (e) => {
        const el = e.originalEvent.target as HTMLElement | undefined;
        if (el?.classList.contains("mapboxgl-ctrl-geocoder")) {
          // ignore clicks on geocoding search bar, which is on top of map
          return;
        }

        setValue("longitude", e.lngLat.lng);
        setValue("latitude", e.lngLat.lat);
      });
    });

    setMap(_map);
    return () => {
      _map.remove();
      setMap(undefined);
    };
  }, []);

  useEffect(() => {
    (map?.getSource("source") as mapboxgl.GeoJSONSource)?.setData(
      mapToGeoJSON({
        latitude: values.latitude,
        longitude: values.longitude,
        radius: values.radius,
      }),
    );
  }, [values.latitude, values.longitude, values.radius]);

  async function getPlaceInfo(
    longitude: number,
    latitude: number,
  ): Promise<PlaceInfo> {
    // https://docs.mapbox.com/api/search/geocoding/#reverse-geocoding
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&cachebuster=1618224066302&autocomplete=true&types=locality%2Cplace`,
    );
    const data = await response.json();
    const address = data.features[0]?.place_name;
    console.log("data.feat[0]", data.features[0]);
    const countryCode = data.features[0]?.context.pop().short_code;
    return { address: address, countryCode: countryCode };
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!values.genders?.length) {
      addToastError(t("required") + ": " + t("categories"), 400);
      return;
    }
    if (!values.sizes?.length) {
      addToastError(t("required") + ": " + t("sizes"), 400);
      return;
    }

    (async () => {
      if (!(values.longitude && values.latitude)) {
        addToastError(t("required") + ": " + t("loopLocation"), 400);
        return;
      }
      const placeInfo = await getPlaceInfo(values.longitude, values.latitude);
      values.address = placeInfo.address;
      values.country_code = placeInfo.countryCode;
      if (!(values.longitude && values.latitude)) {
        console.error("getPlaceInfo", values.address, values.country_code);
        addToastError(t("required") + ": " + t("loopLocation"), 500);
        return;
      }

      onSubmit(values);
    })();
  }

  function handleCategoriesChange(selectedGenders: string[]) {
    setValue("genders", selectedGenders as Genders[]);
    // potentially remove some sizes if their parent category has been deselected
    const filteredSizes = (values.sizes || []).filter(
      (size) =>
        selectedGenders.filter((gender) =>
          categories[gender as Genders].includes(size as Sizes),
        ).length > 0,
    );
    setValue("sizes", filteredSizes);
  }
  return (
    <div className="flex flex-col md:flex-row">
      <div className="md:w-1/2 md:pr-4 rtl:md:pr-0 rtl:md:pl-4">
        <div className="aspect-square cursor-pointer" ref={mapRef} />
      </div>
      <div className="md:w-1/2 md:pl-4 rtl:md:pl-0 rtl:md:pr-4">
        <form onSubmit={handleSubmit}>
          <p className="mb-2 text-sm">{t("clickToSetLoopLocation")}</p>
          <TextForm
            classes={{ root: "" }}
            required
            min={3}
            label={t("loopName")}
            name="name"
            type="text"
            value={values.name}
            onChange={(e) => setValue("name", e.target.value)}
            info={t("upToYouUsuallyTheGeopraphic")!}
          />

          <TextForm
            type="number"
            required
            label={t("radius")}
            name="radius"
            value={values.radius / 4}
            onChange={(e) => setValue("radius", e.target.valueAsNumber * 4)}
            step="0.1"
            info={t("decideOnTheAreaYourLoopWillBeActiveIn")!}
          />

          <div className="form-control relative w-full mb-4">
            <PopoverOnHover
              message={t("optionalFieldTypeAnything")}
              className="absolute top-0 -right-2 rtl:right-auto rtl:-left-2 tooltip-left"
            />
            <label>
              <div className="label">
                <span className="label-text">{t("description")}</span>
              </div>
              <textarea
                className="textarea textarea-secondary w-full"
                name="description"
                cols={3}
                value={values.description}
                onChange={(e) => setValue("description", e.target.value)}
              />
            </label>
          </div>

          {showAllowedTOH ? (
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text">
                  <Trans
                    i18nKey="iAccept<1>Toh</1>Star"
                    components={{
                      "1": (
                        <a
                          href={localizePath("/terms-of-hosts")}
                          target="_blank"
                          className="link"
                        ></a>
                      ),
                    }}
                  ></Trans>
                </span>
                <input
                  type="checkbox"
                  required
                  className="checkbox border-black"
                  name="toh"
                />
              </label>
            </div>
          ) : null}

          {showAllowedDPA ? (
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text">
                  <Trans
                    i18nKey="iAccept<1>Dpa</1>Star"
                    components={{
                      "1": (
                        <a
                          href={localizePath("/data-processing-agreement")}
                          target="_blank"
                          className="link"
                        ></a>
                      ),
                    }}
                  ></Trans>
                </span>
                <input
                  type="checkbox"
                  required
                  className="checkbox border-black"
                  name="toh"
                />
              </label>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row items-end mb-6">
            <div className="w-full sm:w-1/2 pb-4 sm:pb-0 sm:pr-4 rtl:sm:pr-0 rtl:sm:pl-4">
              <CategoriesDropdown
                className="dropdown-top"
                selectedGenders={values.genders || []}
                handleChange={handleCategoriesChange}
              />
            </div>
            <div className="w-full sm:w-1/2">
              <div className="flex justify-end -mr-2 -mt-3">
                <PopoverOnHover
                  message={t("mixedBagsUsuallyWorkBestThereforeWeRecommentTo")}
                  className="tooltip-left"
                />
              </div>
              <SizesDropdown
                className="dropdown-top"
                filteredGenders={
                  values.genders?.length
                    ? values.genders
                    : [Genders.children, Genders.women, Genders.men]
                }
                selectedSizes={values.sizes || []}
                handleChange={(v) => setValue("sizes", v)}
              />
            </div>
          </div>

          <div className="flex flex-row">
            {showBack && (
              <button
                type="button"
                className="btn btn-secondary btn-outline mr-4 rtl:mr-0 rtl:ml-4"
                onClick={() => window.history.back()}
              >
                {t("back")}
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              {submitText}
              <span className="feather feather-arrow-right ml-4 rtl:hidden"></span>
              <span className="feather feather-arrow-left mr-4 ltr:hidden"></span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
