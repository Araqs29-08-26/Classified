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
  hasPrice,
}: {
  number: string;
  status: string;
  index: number;
  priceFrom: string;
  priceTo: string;
  /** У обычного номера движок цены не называет — тогда её нет и в сообщении. */
  hasPrice: boolean;
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
    return hasPrice
      ? t("text", { number, status, index, from: priceFrom, to: priceTo })
      : t("textNoPrice", { number, status, index });
  }

  async function share() {
    const url = link();
    const data = { title: t("title"), text: text(), url };

    // Сначала пробуем системное окно «Поделиться»: на телефоне оно знает,
    // какие мессенджеры у человека вправду стоят, а список кнопок — нет.
    //
    // Но полагаться на него одно нельзя. На настольном браузере оно есть
    // далеко не везде, а там, где есть, умеет отказать — и тогда нажатие
    // не даёт НИЧЕГО, кнопка выглядит сломанной. Поэтому любой отказ, кроме
    // осознанной отмены человеком, разворачивает наш собственный список.
    const canShare =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      (typeof navigator.canShare !== "function" || navigator.canShare(data));

    if (canShare) {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        // Человек сам закрыл системное окно — значит, передумал.
        if ((error as { name?: string })?.name === "AbortError") return;
      }
    }

    setOpen((prev) => !prev);
  }

  async function copy() {
    const full = `${text()} ${link()}`;

    // Буфер обмена доступен не всегда: в некоторых браузерах его просто нет,
    // а по незащищённому соединению он отключён. Говорить «скопировано», когда
    // ничего не скопировалось, нельзя — человек вставит пустоту и не поймёт.
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(full);
        setCopied(true);
        return;
      }
    } catch {
      // Пробуем старый способ ниже.
    }

    const box = document.createElement("textarea");
    box.value = full;
    box.setAttribute("readonly", "");
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(box);
    setCopied(ok);
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
          <button type="button" className="btn btn-ghost" onClick={() => void copy()}>
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      )}
    </>
  );
}
