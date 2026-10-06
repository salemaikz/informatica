"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { levelInfo } from "@/lib/gamification";
import { getHome, getMe, socialStateOf, type HomeData, type ProfileInput, type SocialState } from "@/lib/social/client";
import type { MyPlayer } from "@/lib/social/view";

// Хуки соцчасти (этап 16Д, Ф3). Запросы — из эффектов только в виде fetch с setState в обработчике ответа (не синхронно),
// опрос входящих — раз в 30 с, только на видимой вкладке и не дольше 5 минут без действий ученика (docs/specs/duels.md §5).

/** Профиль для POST /api/social/me из стора: язык, уровень, надетые рамка и титул. Фото, класс, цель — не уходят никогда. */
export function profileInput(name: string | null, ft: boolean): ProfileInput {
  const s = useApp.getState();
  return {
    name,
    lang: s.profile.lang === "kk" ? "kk" : "ru",
    lv: levelInfo(s.xp).level,
    cosmetics: { frame: s.cosmetics.equipped.frame ?? null, title: s.cosmetics.equipped.title ?? null },
    ft,
  };
}

/** Нужно ли обновить карточку на сервере (уровень, рамка, титул поменялись). */
export function profileStale(p: MyPlayer): boolean {
  const s = useApp.getState();
  return p.lv !== levelInfo(s.xp).level || p.frame !== (s.cosmetics.equipped.frame ?? null) || p.title !== (s.cosmetics.equipped.title ?? null);
}

/** Состояние соцчасти один раз на вкладку (для кнопок «Вызвать друга» вне хаба). */
let stateOnce: Promise<SocialState> | null = null;

export function useSocialState(): SocialState | null {
  const [state, setState] = useState<SocialState | null>(null);
  useEffect(() => {
    let alive = true;
    stateOnce ??= getMe().then((r) => socialStateOf(r));
    void stateOnce.then((s) => {
      if (alive) setState(s);
      if (s === "down") stateOnce = null;
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

const POLL_MS = 30_000;
const POLL_FOR_MS = 5 * 60_000;

/** Главная соцчасти для хаба: профиль, входящие, число заявок. Опрос 30 с на видимой вкладке, стоп через 5 минут. */
export function useSocialHome(): { state: SocialState | null; home: HomeData | null; reload: () => void } {
  const [state, setState] = useState<SocialState | null>(null);
  const [home, setHome] = useState<HomeData | null>(null);
  const [tick, setTick] = useState(0);
  const since = useRef(0);

  useEffect(() => {
    const ctl = new AbortController();
    void getHome(ctl.signal).then((r) => {
      if (ctl.signal.aborted) return;
      setState(socialStateOf(r));
      if (r.ok && r.data) setHome(r.data);
    });
    return () => ctl.abort();
  }, [tick]);

  useEffect(() => {
    since.current = Date.now();
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible" || Date.now() - since.current > POLL_FOR_MS) return;
      setTick((n) => n + 1);
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      since.current = Date.now();
      setTick((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return { state, home, reload: () => setTick((n) => n + 1) };
}

/** Профиль игрока соцчасти (GET /api/social/me). */
export function useMyPlayer(): { state: SocialState | null; player: MyPlayer | null; loaded: boolean; setPlayer: (p: MyPlayer | null) => void; reload: () => void } {
  const [state, setState] = useState<SocialState | null>(null);
  const [player, setPlayer] = useState<MyPlayer | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    void getMe(ctl.signal).then((r) => {
      if (ctl.signal.aborted) return;
      setState(socialStateOf(r));
      setPlayer(r.ok ? r.data : null);
      setLoaded(true);
    });
    return () => ctl.abort();
  }, [tick]);
  return { state, player, loaded, setPlayer, reload: () => setTick((n) => n + 1) };
}
