"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * «Отправить другу» — переслать разбор номера.
 *
 * Пересылается ссылка, а не картинка: по ней у друга откроется тот же разбор,
 * посчитанный заново, — со статусом, узором и ценой. Номер сидит в адресе,
 * язык — в самом пути, поэтому ссылка воспроизводит ровно то, что было видно
 * отправителю.
 *
 * На телефоне открывается обычное окно «Поделиться» — в нём человек выбирает
 * тот мессенджер, который у него вправду стоит. Списка кнопок хватает там,
 * где такого окна нет: на настольном браузере.
 */
export default function ShareReview({
  number,
  status,
  index,
  priceFrom,
  priceTo,
}: {
  number: string;
  status: string;
  index: number;
  priceFrom: string;
  priceTo: string;
}) {
  const t = useTranslations("sell.share");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  /** Адрес разбора. Номер дописывается всегда — вдруг его в адресе ещё нет. */
  function link(): string {
    const url = new URL(window.location.href);
    url.searchParams.set("number", number);
    return url.toString();
  }

  function text(): string {
    return t("text", { number, status, index, from: priceFrom, to: priceTo });
  }

  async function share() {
    const url = link();

    // Своё окно показывается только там, где системного нет: на телефоне
    // системное знает, какие мессенджеры у человека стоят, а список кнопок —
    // нет. Отмена в системном окне — это не ошибка, и её нечем заменять.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: t("title"), text: text(), url });
        return;
      } catch {
        return;
      }
    }

    setOpen((prev) => !prev);
  }

  function copy() {
    void navigator.clipboard?.writeText(`${text()} ${link()}`);
    setCopied(true);
  }

  const message = () => encodeURIComponent(`${text()} ${link()}`);

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={share}>
        {t("button")}
      </button>

      {open && (
        <div className="share-row">
          <a
            className="btn btn-ghost"
            href={`https://wa.me/?text=${message()}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
          <a
            className="btn btn-ghost"
            href={`https://t.me/share/url?url=${encodeURIComponent(
              link()
            )}&text=${encodeURIComponent(text())}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Telegram
          </a>
          <a className="btn btn-ghost" href={`viber://forward?text=${message()}`}>
            Viber
          </a>
          <button type="button" className="btn btn-ghost" onClick={copy}>
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      )}
    </>
  );
}
