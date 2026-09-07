import type { ReactNode } from "react";

// Пустой корневой макет — намеренно.
//
// Next.js требует, чтобы корневой макет существовал, иначе не принимает
// корневую not-found.tsx. Но <html> и <body> он здесь рисовать не должен:
// для обычных страниц их рисует [locale]/layout.tsx, а для заглушки — она сама.
// Если добавить теги сюда, они удвоятся.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
