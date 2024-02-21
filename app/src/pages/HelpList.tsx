import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonList,
  IonPage,
  IonRouterLink,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  logoFacebook,
  logoInstagram,
  logoLinkedin,
  mail,
  pencilOutline,
} from "ionicons/icons";
import { useTranslation } from "react-i18next";
import { IsChainAdmin, StoreContext } from "../Store";
import { useContext, useMemo, useRef, useState } from "react";
import CreateUpdateRules from "../components/CreateUpdateRules";
import { FaqListItem, faqItemTranslationOption, faqListKeys } from "./HelpItem";
import { User } from "../api";
import EditHeaders from "../components/EditHeaders";
import { useLongPress } from "use-long-press";

interface MediaIcon {
  icon: string;
  label: string;
  url: string;
  color: string;
}

const mediaIcons: MediaIcon[] = [
  {
    icon: logoInstagram,
    label: "Instagram",
    url: "https://www.instagram.com/theclothingloop/",
    color: "#EB4141",
  },
  {
    icon: mail,
    label: "Email",
    url: "mailto:hello@clothingloop.org",
    color: "#b464a8",
  },
  {
    icon: logoLinkedin,
    label: "LinkedIn",
    url: "https://www.linkedin.com/company/the-clothing-loop/",
    color: "#0a66c2",
  },
  {
    icon: logoFacebook,
    label: "Facebook",
    url: "https://www.facebook.com/clothingloop/",
    color: "#1b74e4",
  },
];

export default function HelpList() {
  const { t } = useTranslation();
  const {
    authUser,
    chain,
    chainUsers,
    setChain,
    isChainAdmin,
    isThemeDefault,
  } = useContext(StoreContext);
  const modal = useRef<HTMLIonModalElement>(null);
  const headerSheetModal = useRef<HTMLIonModalElement>(null);

  const longPressHeader = useLongPress(() => {
    headerSheetModal.current?.present();
  });

  const header = useMemo(() => {
    if (chain?.headers_override) {
      const headers = JSON.parse(chain.headers_override);
      return headers.helpList
        ? (headers.helpList as string)
        : t("howDoesItWork");
    }
    return t("howDoesItWork");
  }, [chain]);

  const rules = useMemo<FaqListItem[]>(() => {
    if (chain?.rules_override) {
      return JSON.parse(chain.rules_override) as FaqListItem[];
    }

    return faqListKeys.map((k) => t(k, faqItemTranslationOption) as any);
  }, [chain]);

  const hosts = useMemo<User[]>(
    () => chainUsers.filter((u) => IsChainAdmin(u, chain?.uid)),
    [chainUsers, chain],
  );

  function handleClickChange() {
    modal.current?.present();
  }

  function refreshChain() {
    setChain(chain?.uid, authUser);
  }
  function handleClickEdit() {
    headerSheetModal.current?.present();
  }

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle className={isThemeDefault ? "tw-text-purple" : ""}>
            {header}
          </IonTitle>

          {isChainAdmin ? (
            <IonButtons slot="end">
              <IonButton
                onClick={handleClickChange}
                className={isThemeDefault ? "!tw-text-purple" : ""}
              >
                {t("change")}
              </IonButton>
            </IonButtons>
          ) : null}
        </IonToolbar>
      </IonHeader>
      <IonContent
        fullscreen
        class={isThemeDefault ? "tw-bg-purple-contrast" : ""}
      >
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle
              size="large"
              className={`tw-font-serif tw-font-bold ${
                isThemeDefault ? "tw-text-purple " : ""
              }`}
              {...(isChainAdmin ? { ...longPressHeader() } : "")}
            >
              {header}
              <IonIcon
                icon={pencilOutline}
                className="tw-text-sm tw-ml-1.5 tw-mb-3.5"
              />
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonList>
          {rules.map((item, index) => (
            <IonItem routerLink={"/help/" + index} lines="full" key={index}>
              {item.title}
            </IonItem>
          ))}
        </IonList>
        <div className="tw-relative tw-overflow-hidden">
          <p className="ion-text-center ion-text-uppercase !tw-font-bold tw-text-medium tw-text-sm tw-leading-4 tw-mt-4 tw-m-0">
            {t("loopHost", { count: hosts.length })}
          </p>
          <div className="tw-flex tw-justify-center tw-flex-wrap tw-mt-1.5 tw-m-0 tw-mb-2.5">
            {hosts.map((host) => (
              <IonButton
                key={host.uid}
                size="small"
                routerLink={"/address/" + host.uid}
                color="light"
                className="tw-m-1.5 tw-text-base"
              >
                {host.name}
              </IonButton>
            ))}
          </div>
          <p className="ion-text-center ion-text-uppercase !tw-font-bold tw-text-medium tw-text-sm tw-leading-4 tw-m-0">
            {t("organization")}
          </p>
          <div className="tw-flex tw-justify-center">
            {mediaIcons.map((mi) => (
              <IonRouterLink
                rel="noreferrer"
                target="_blank"
                href={mi.url}
                key={mi.label}
                className="ion-margin"
              >
                <IonIcon
                  size="large"
                  icon={mi.icon}
                  style={{ color: mi.color }}
                  aria-label={mi.label}
                />
              </IonRouterLink>
            ))}
          </div>
          <IonRouterLink
            href="https://www.clothingloop.org/"
            className="ion-text-center ion-margin-bottom tw-block tw-text-dark tw-text-sm tw-leading-4 !tw-mb-6"
          >
            www.clothingloop.org
          </IonRouterLink>
          <CreateUpdateRules
            rules={chain?.rules_override || null}
            modal={modal}
            didDismiss={refreshChain}
          />
          <EditHeaders
            modal={headerSheetModal}
            didDismiss={refreshChain}
            page={"helpList"}
            initalHeader={t("howDoesItWork")}
          />
          <IonIcon
            aria-hidden="true"
            icon="/v2_o.svg"
            style={{ fontSize: 500 }}
            color={isThemeDefault ? "" : "light"}
            className="tw-absolute -tw-right-64 -tw-bottom-60 -tw-z-10 tw-text-purple-shade"
          />
        </div>
      </IonContent>
    </IonPage>
  );
}
