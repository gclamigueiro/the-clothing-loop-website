//Resources

import { useEffect, useMemo, useState } from "react";

import { userPurge } from "../../../api/user";

import ChainsList from "../components/ChainsList";
import { useEscape } from "../util/escape.hooks";
import type { Chain } from "../../../api/types";
import PopupLegal from "../components/PopupLegal";
import { useTranslation } from "react-i18next";
import { useStore } from "@nanostores/react";
import { $authUser, authUserRefresh } from "../../../stores/auth";
import { addModal } from "../../../stores/toast";
import useLocalizePath from "../util/localize_path.hooks";

export default function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const localizePath = useLocalizePath(i18n);
  const authUser = useStore($authUser);

  const [chains, setChains] = useState<Chain[]>([]);
  const [tmpAcceptedToh, setTmpAcceptedToh] = useState(false);

  const isChainAdmin = useMemo(
    () => !!authUser?.chains.find((uc) => uc.is_chain_admin),
    [authUser],
  );

  function deleteClicked() {
    if (!authUser) return;
    const chainNames = authUser.is_root_admin
      ? undefined
      : (authUser.chains
          .filter((uc) => uc.is_chain_admin)
          .map((uc) => chains.find((c) => c.uid === uc.chain_uid))
          .filter((c) => c && c.total_hosts && c.total_hosts === 1)
          .map((c) => c!.name) as string[]);

    addModal({
      message: t("deleteAccount"),
      content:
        chainNames && chainNames.length
          ? () => (
              <>
                <p className="mb-2">{t("deleteAccountWithLoops")}</p>
                <ul
                  className={`text-sm font-semibold mx-8 ${
                    chainNames.length > 1
                      ? "list-disc"
                      : "list-none text-center"
                  }`}
                >
                  {chainNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </>
            )
          : undefined,
      actions: [
        {
          text: t("delete"),
          type: "error",
          fn: () => {
            userPurge(authUser!.uid).then(() => {
              window.location.href = localizePath("/users/logout");
            });
          },
        },
      ],
    });
  }

  function logoutClicked() {
    addModal({
      message: t("areYouSureLogout"),
      actions: [
        {
          text: t("logout"),
          type: "error",
          fn: () => {
            window.location.href = localizePath("/users/logout");
          },
        },
      ],
    });
  }

  useEffect(() => {
    if (
      authUser &&
      isChainAdmin &&
      (authUser.accepted_toh === false || authUser.accepted_dpa === false)
    ) {
      if (authUser.accepted_toh)
        console.log("You have not accepted the Terms of Hosts!");
      if (authUser.accepted_dpa)
        console.log("You have not accepted the Data Processing Agreement!");
      PopupLegal({
        t,
        authUserRefresh: () => authUserRefresh(true),
        addModal,
        authUser,
        tmpAcceptedToh,
        setTmpAcceptedToh,
      });
    }
  }, [authUser, isChainAdmin]);

  useEscape(() => {
    let el = document.getElementById(
      "modal-circle-loop",
    ) as HTMLInputElement | null;
    if (el && el.checked) {
      el.checked = false;
    }
  });

  if (authUser === null) {
    window.location.href = localizePath("/users/login");
    return <div></div>;
  }

  if (!authUser) return null;
  return (
    <>
      <main>
        <section className="bg-teal-light mb-6">
          <div className="relative container mx-auto px-5 md:px-20">
            <div className="z-10 flex flex-col items-between py-8">
              <div className="flex-grow max-w-screen-xs">
                <h1 className="font-serif font-bold text-4xl text-secondary mb-3">
                  {t("helloN", { n: authUser.name })}
                </h1>
                <p className="mb-6">
                  {t("thankYouForBeingHere")}
                  <br />
                  <br />
                  {t("goToTheToolkitFolder")}
                </p>
              </div>

              {authUser.is_root_admin || isChainAdmin ? (
                <div className="flex flex-col sm:flex-row flex-wrap rtl:sm:-mr-4">
                  <a
                    className="btn btn-primary h-auto mb-4 sm:mr-4 text-black"
                    target="_blank"
                    href="https://drive.google.com/drive/folders/1iMJzIcBxgApKx89hcaHhhuP5YAs_Yb27"
                  >
                    {t("toolkitFolder")}
                    <span className="feather feather-external-link ml-2 rtl:ml-0 rtl:mr-2"></span>
                  </a>
                </div>
              ) : null}
              <div className="flex flex-col sm:flex-row flex-wrap rtl:sm:-mr-4">
                <a
                  className="btn btn-sm btn-secondary btn-outline bg-white mb-4 sm:mr-4"
                  href={localizePath("/users/edit/?user=me")}
                >
                  {t("editAccount")}
                  <span className="feather feather-edit ml-2 rtl:ml-0 rtl:mr-2"></span>
                </a>
                <button
                  className="btn btn-sm btn-secondary btn-outline bg-white h-auto mb-4 sm:mr-4 text-black group"
                  onClick={logoutClicked}
                >
                  {t("logout")}
                  <span className="feather feather-log-out text-red group-hover:text-white ml-2 rtl:ml-0 rtl:mr-2"></span>
                </button>

                <button
                  className="btn btn-sm btn-error btn-outline bg-white/60 mb-4 sm:mr-4"
                  onClick={deleteClicked}
                >
                  <span className="text-danger">{t("deleteUserBtn")}</span>
                  <span className="feather feather-alert-octagon ml-2 rtl:ml-0 rtl:mr-2"></span>
                </button>
              </div>
            </div>
            <label
              htmlFor="modal-circle-loop"
              className="z-0 hidden lg:flex absolute top-0 right-0 rtl:right-auto rtl:left-0 bottom-0 h-full cursor-zoom-in overflow-hidden aspect-[4/3]"
            >
              <img
                className="h-full hover:scale-105 transition-transform object-cover self-center cursor-zoom-in"
                src="https://images.clothingloop.org/cx164,cy1925,cw4115,ch3086,x640/circle_loop.jpg"
              />
            </label>
          </div>
          <input
            type="checkbox"
            id="modal-circle-loop"
            className="modal-toggle"
          />
          <div className="modal">
            <label
              className="relative max-w-[100vw] max-h-[100vh] h-full justify-center items-center flex cursor-zoom-out"
              aria-label="close"
              htmlFor="modal-circle-loop"
            >
              <div className="btn btn-sm btn-square absolute right-2 top-2 feather feather-x"></div>
              <img
                className="max-h-full"
                src="https://images.clothingloop.org/x1080/circle_loop.jpg"
              />
            </label>
          </div>
        </section>
        <ChainsList chains={chains} setChains={setChains} />
      </main>
    </>
  );
}
