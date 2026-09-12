"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * «Отправить другу» — переслать разбор номера.
 *
 * Пересылается ссылка, а не картинка: по ней у друга откроется тот же разбор,
 * посчитанный заново, — со статусом, узором и ценой. Номер и настройки сидят
 * в адресе, язык — в самом пути, поэтому ссылка воспроизводит ровно то, что
 * было видно отправителю.
 *
 * ПОЧЕМУ НЕ СИСТЕМНОЕ ОКНО «ПОДЕЛИТЬСЯ». На телефоне оно показывает
 * мессенджеры, а на настольной Windows — «Мой телефон», «Dropbox для
 * S-режима», «OneNote» и обмен по Bluetooth. Человек хотел отправить
 * сообщение другу, а получил список того, чем не пользуется. Поэтому
 * предлагаются те три мессенджера, которыми в Армении вправду пишут, и
 * ссылка для всего остального.
 */
const MESSENGERS = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    href: (text: string, url: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: "telegram",
    name: "Telegram",
    href: (text: string, url: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "viber",
    name: "Viber",
    href: (text: string, url: string) =>
      `viber://forward?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
] as const;

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

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {t("button")}
      </button>

      {open && (
        <div className="share-row">
          {MESSENGERS.map((m) => (
            <a
              key={m.id}
              className={`btn btn-ghost share-${m.id}`}
              href={m.href(text(), link())}
              target="_blank"
              rel="noopener noreferrer"
            >
              {m.name}
            </a>
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void copy()}
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      )}
    </>
  );
}
