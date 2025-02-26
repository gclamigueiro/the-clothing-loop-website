import { useState, useEffect, useMemo, Fragment, type MouseEvent } from "react";

import {
  eventGet,
  eventICalURL,
  EVENT_IMAGE_EXPIRATION,
  eventUpdate,
  eventDelete,
} from "../../../api/event";
import type { Event } from "../../../api/types";
import { SizeBadges } from "../components/Badges";

import { GinParseErrors } from "../util/gin-errors";
import dayjs from "../util/dayjs";
import useToClipboard from "../util/to-clipboard.hooks";

import { uploadImage } from "../../../api/imgbb";
import SanitizedHtml from "../components/SanitizedHtml";
import { useTranslation } from "react-i18next";
import { useStore } from "@nanostores/react";
import { $authUser } from "../../../stores/auth";
import { addModal, addToastError } from "../../../stores/toast";
import useLocalizePath from "../util/localize_path.hooks";
import getQuery from "../util/query";

// Media
const ClothesImage =
  "https://images.clothingloop.org/768x/nichon_zelfportret.jpg";
const CirclesFrame = "https://images.clothingloop.org/0x0/circles.png";

export default function EventDetails() {
  const { t, i18n } = useTranslation();
  const localizePath = useLocalizePath(i18n);

  const authUser = useStore($authUser);
  const [event, setEvent] = useState<Event>();
  const [eventUID] = getQuery("event");

  const addCopyAttributes = useToClipboard();
  const [imageExpanded, setImageExpanded] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const { date, dateEnd, sameDate } = useMemo(() => {
    if (!event)
      return {
        date: null,
        dateEnd: null,
        sameDate: false,
      };

    let sameDate = false;
    const date = dayjs(event.date);
    const dateEnd = event.date_end ? dayjs(event.date_end) : null;
    if (dateEnd && date.isSame(dateEnd, "day")) {
      sameDate = true;
    }

    return {
      date: dayjs(event.date),
      dateEnd: event.date_end ? dayjs(event.date_end) : null,
      sameDate,
    };
  }, [event, i18n.language]);

  async function load() {
    try {
      await eventGet(eventUID).then((res) => {
        setEvent(res.data);
      });
    } catch (err: any) {
      console.error(err);
      addToastError(GinParseErrors(t, err), err.status);
    }
  }

  function handleUploadImage(e: MouseEvent<HTMLInputElement>) {
    e.preventDefault();

    //@ts-ignore
    let file = (e.target.files as FileList)[0];
    if (!file || !event) return;

    (async () => {
      try {
        const res = await uploadImage(file, 800, EVENT_IMAGE_EXPIRATION);
        await eventUpdate({
          uid: event.uid,
          image_url: res.data.image,
          image_delete_url: res.data.delete,
        });
        await load();
      } catch (err: any) {
        console.error(err);
        addToastError(GinParseErrors(t, err), err.status);
      }
    })();
  }

  async function handleDeleteEvent() {
    if (!event) return;
    const eventUID = event.uid;
    addModal({
      message: t("areYouSureRemoveEvent"),
      actions: [
        {
          type: "error",
          text: t("delete"),
          fn() {
            eventDelete(eventUID)
              .then(() => {
                window.history.back();
              })
              .catch((err: any) => {
                console.error(err);
                addToastError(GinParseErrors(t, err), err.status);
              });
          },
        },
      ],
    });
  }

  if (!event) {
    return (
      <div className="max-w-screen-sm mx-auto flex-grow flex flex-col justify-center items-center">
        <h1 className="font-serif text-secondary text-4xl font-bold my-10">
          {t("eventNotFound")}
        </h1>
        <div className="flex">
          <a href={localizePath("/")} className="btn btn-primary mx-4">
            {t("home")}
          </a>
          <a href={localizePath("/events")} className="btn btn-primary mx-4">
            {t("events")}
          </a>
        </div>
      </div>
    );
  } else {
    const icalURL = eventICalURL(event.uid);
    const icalFilename = `${event.name}.ics`;
    const isOrganizer = authUser
      ? authUser.uid === event.user_uid || authUser.is_root_admin
      : false;
    let image = ClothesImage;
    if (event.image_url) image = event.image_url;

    const eventPriceValue =
      event.price_value % 1 === 0
        ? event.price_value
        : event.price_value.toFixed(2);
    return (
      <>
        <main>
          <div className="bg-teal-light">
            <div className="max-w-screen-xl mx-auto py-6 px-6 md:px-20">
              <h1 className="font-serif font-bold text-secondary text-4xl md:text-6xl mb-6 px-0">
                {event.name}
              </h1>
              <div className="flex flex-col sm:flex-row md:mt-6 space-y-4 sm:space-y-0">
                <a
                  href={icalURL}
                  download={icalFilename}
                  className="btn btn-primary sm:me-4"
                >
                  <span className="relative mr-4 rtl:mr-1 rtl:ml-3" aria-hidden>
                    <span className="inline-block feather feather-calendar relative transform scale-125"></span>
                    <span className="absolute -bottom-2 -right-2.5 transform scale-90 feather feather-download"></span>
                  </span>
                  {t("addToCalendar")}
                </a>
                {isOrganizer ? (
                  <>
                    <a
                      href={`/events/` + event.uid + `/edit`}
                      className="btn btn-secondary btn-outline sm:me-4"
                    >
                      <span className="feather feather-edit mr-3 rtl:mr-0 rtl:ml-3"></span>
                      {t("edit")}
                    </a>
                    <button
                      type="button"
                      className="btn btn-error"
                      aria-label={t("delete")!}
                      onClick={handleDeleteEvent}
                    >
                      <span className="feather feather-trash"></span>
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <div className="max-w-screen-xl mx-auto pt-6 px-6 md:px-20">
            <div className="flex flex-col md:flex-row-reverse">
              <div className="w-full md:w-3/5 md:-mt-20 mb-4 md:mb-0 ml-0 md:ml-12 lg:ml-20 rtl:ml-0 rtl:md:mr-12 rtl:lg:mr-20">
                <div className="relative">
                  <dl className="z-10 relative bg-white md:shadow-[2px_3px_3px_1px_rgba(66,66,66,0.2)] md:py-10 md:px-8">
                    {date ? (
                      <>
                        <dt className="mb-2 font-bold font-sans text-xl text-teal">
                          {t("time") + ":"}
                        </dt>
                        <dd className="mb-1 ltr:ml-4 rtl:mr-4">
                          <span
                            className="ltr:mr-2 rtl:ml-2 inline-block feather feather-clock"
                            aria-hidden
                          ></span>
                          {dateEnd ? (
                            sameDate ? (
                              <Fragment>
                                <span className="font-sans text-lg">
                                  {date?.format("LL")}
                                </span>
                                <br />
                                <span className="font-sans text-lg ltr:ml-6 rtl:mr-6">
                                  {date?.format("LT")}
                                </span>
                                <span
                                  className="inline-block feather feather-arrow-right mx-2 rtl:hidden"
                                  aria-hidden
                                ></span>{" "}
                                <span
                                  className="inline-block feather feather-arrow-left mx-2 ltr:hidden"
                                  aria-hidden
                                ></span>
                                <span className="font-sans text-lg">
                                  {dateEnd.format("LT")}
                                </span>
                              </Fragment>
                            ) : (
                              <Fragment>
                                <span className="font-sans text-lg">
                                  {date?.format("LLL")}
                                </span>
                                <br />
                                <span
                                  className="block feather feather-arrow-down"
                                  aria-hidden
                                ></span>
                                <span
                                  className="ltr:mr-2 rtl:ml-2 inline-block feather feather-clock rotate-90"
                                  aria-hidden
                                ></span>
                                <span className="font-sans text-lg">
                                  {dateEnd.format("LLL")}
                                </span>
                              </Fragment>
                            )
                          ) : (
                            <span className="font-sans text-lg">
                              {date?.format("LLL")}
                            </span>
                          )}
                        </dd>
                      </>
                    ) : null}
                    <dt className="mb-2 font-bold font-sans text-xl text-teal">
                      {t("price") + ":"}
                    </dt>
                    <dd className="mb-1 ltr:ml-4 rtl:mr-4">
                      <span className="ltr:mr-2 rtl:ml-2 inline-block feather feather-tag"></span>
                      {event.price_currency ? (
                        <span className="font-sans text-lg" key="price">
                          {event.price_currency + " " + eventPriceValue}
                        </span>
                      ) : (
                        <span className="font-sans text-lg" key="free">
                          {t("priceFree")}
                        </span>
                      )}
                    </dd>
                    {event.address ? (
                      <Fragment key="address">
                        <dt className="mb-2 font-bold font-sans text-xl text-teal">
                          {t("location") + ":"}
                        </dt>
                        <dd className="mb-1 ltr:ml-4 rtl:mr-4">
                          <span
                            className="ltr:mr-2 rtl:ml-2 feather feather-map-pin"
                            aria-hidden
                          ></span>
                          <address
                            {...addCopyAttributes(
                              t,
                              "event-detail-address-" + event.uid,
                              "text-lg inline",
                            )}
                          >
                            {event.address}
                          </address>
                        </dd>
                      </Fragment>
                    ) : null}
                    <dt
                      className={`mb-2 font-bold font-sans text-xl text-teal ${
                        event.genders?.length ? "" : "hidden"
                      }`}
                    >
                      {t("categories") + ":"}
                    </dt>

                    <dd className="mb-1 ltr:ml-4 rtl:mr-4 block">
                      {event.genders?.length ? (
                        <SizeBadges g={event.genders} />
                      ) : null}
                    </dd>
                    <dt
                      className={`mb-2 font-bold font-sans text-xl text-teal ${
                        event.chain_uid || event.link ? "" : "hidden"
                      }`}
                    >
                      {t("organizedBy") + ":"}
                    </dt>
                    <dd
                      className={`mr-2 mb-1 ltr:ml-4 rtl:mr-4 ${
                        event.chain_uid || event.link ? "" : "hidden"
                      }`}
                    >
                      {event.chain_uid ? (
                        <a
                          href={localizePath(
                            "/loops/users/signup/?chain=" + event.chain_uid,
                          )}
                          key="loop"
                          className="group block mb-1"
                        >
                          <span className="ltr:mr-2 rtl:ml-2 inline-block relative">
                            <span
                              className="block feather feather-circle"
                              aria-hidden
                            ></span>
                            <span
                              className="absolute top-1 left-0 block feather feather-circle"
                              aria-hidden
                            ></span>
                          </span>
                          <span className="group-hover:underline">
                            {event.chain_name}
                          </span>
                        </a>
                      ) : null}
                      {event.link ? (
                        <a
                          href={event.link}
                          key="link"
                          className="group block mb-1"
                          target="_blank"
                        >
                          <span
                            className="ltr:mr-2 rtl:ml-2 inline-block feather feather-external-link"
                            aria-hidden
                          ></span>
                          <span className="group-hover:underline">
                            {t("eventLink")}
                          </span>
                        </a>
                      ) : null}
                    </dd>
                    <dd className="mb-1 ltr:ml-4 rtl:mr-4"></dd>
                  </dl>

                  <img
                    src={CirclesFrame}
                    aria-hidden
                    className="absolute -bottom-10  ltr:-right-10 rtl:-left-10 hidden md:block"
                  />
                </div>
              </div>
              <div className="w-full">
                <h2 className="font-sans font-bold text-secondary text-2xl mb-4 px-0">
                  {t("eventDetails") + ":"}
                </h2>
                <div
                  className={`${
                    imageExpanded
                      ? "flex-col-reverse w-full content-center"
                      : ""
                  }`}
                >
                  <div
                    className={`aspect-[4/3] mb-4 ltr:mr-0 rtl:ml-0 relative transtion-[postion] mt-8
                  ${
                    imageExpanded
                      ? "max-w-xl mt-8"
                      : "mt-8 sm:w-64 sm:float-right rtl:sm:float-left sm:m-4 sm:cursor-zoom-in"
                  }`}
                  >
                    {isOrganizer ? (
                      <div className="absolute top-2 right-2 rtl:right-auto rtl:left-2 flex flex-row-reverse">
                        <label
                          key="upload-image"
                          className="tooltip tooltip-left md:!tooltip-bottom"
                          data-tip={t("uploadImage")}
                        >
                          <input
                            type="file"
                            id="event-details-form-img-file"
                            accept="image/png, image/jpeg"
                            name="filename"
                            className="hidden"
                            onInput={handleUploadImage}
                          />
                          <div
                            className="btn btn-ghost bg-white/90 hover:bg-white btn-sm btn-square feather feather-upload"
                            aria-label="Upload image"
                          ></div>
                        </label>
                      </div>
                    ) : null}
                    <img
                      src={image}
                      alt=""
                      id="foo"
                      className={"h-full w-full".concat(
                        imageExpanded
                          ? " object-contain"
                          : " object-contain sm:object-cover",
                      )}
                      onClick={() => setImageExpanded(true)}
                    />
                  </div>
                  <SanitizedHtml
                    className="prose"
                    options={{
                      allowedTags: [
                        "small",
                        "sub",
                        "sup",
                        "br",
                        "p",
                        "strong",
                        "b",
                        "em",
                        "ul",
                        "ol",
                        "li",
                        "a",
                      ],
                      allowedAttributes: {
                        a: ["href", "name", "target"],
                      },
                    }}
                  >
                    {event.description}
                  </SanitizedHtml>
                </div>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }
}
