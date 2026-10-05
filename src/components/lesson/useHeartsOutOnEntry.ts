"use client";

import { useEffect, useRef } from "react";
import { track, type HeartOutWhere } from "@/lib/analytics";
import { canAfford } from "@/lib/economy";
import { readHearts } from "@/components/economy/HeartsBar";

/**
 * Событие «сердечки закончились» (#69) для экрана с входом по сердечкам (EntryGate): на входе не хватает на цену — один раз за показ экрана.
 * need = 0 — вход бесплатный или уже оплачен, события нет. Эффект без setState; ref защищает от двойного вызова в разработке.
 */
export function useHeartsOutOnEntry(need: number, where: HeartOutWhere) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (need > 0 && !canAfford(readHearts(), need)) track({ e: "hearts_out", where });
  }, [need, where]);
}
