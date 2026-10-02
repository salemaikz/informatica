"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { decodeCode } from "@/lib/python/codec";

// Песочница работает только в браузере (воркер, localStorage) — без серверного рендера.
const PythonSandbox = dynamic(() => import("./PythonSandbox").then((m) => m.PythonSandbox), { ssr: false });

/** Страница /python: ?code=<base64url> открывает присланный код. */
export function PythonPage() {
  const raw = useSearchParams().get("code");
  const initialCode = decodeCode(raw);
  // Новый код в адресе — новое состояние песочницы.
  return <PythonSandbox key={raw ?? ""} initialCode={initialCode} />;
}
