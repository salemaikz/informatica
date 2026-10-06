"use client";

// Фоновая музыка (этап 16Г, F2): один общий <audio>, preload="none", петля. Играет только на экране-владельце
// (игра, урок, тренировка), только если ученик включил музыку и «Звук»; пауза — в скрытой вкладке и пока идёт видео урока.
// Отказ автозапуска браузером — тихо: пробуем снова при следующем нажатии. Настройка хранится в профиле (profile.music).

import { MUSIC_FILES, resolveTrack, shouldPlayMusic, DEFAULT_MUSIC, type MusicActivity, type MusicPref, type MusicTrackId } from "./music-pref";

export interface MusicSnapshot {
  /** Занятие, которому сейчас разрешена музыка (null — нет экрана-владельца). */
  activity: MusicActivity | null;
  /** Музыка действительно играет. */
  playing: boolean;
  /** Браузер не дал включить (нужно нажатие). */
  unavailable: boolean;
}

const VOLUME = 0.2;
const SILENT: MusicSnapshot = { activity: null, playing: false, unavailable: false };

let snapshot = SILENT;
let pref: MusicPref = DEFAULT_MUSIC;
let sound = true;
let videoPlaying = false;
let owner: symbol | null = null;
let activity: MusicActivity | null = null;
let audio: HTMLAudioElement | null = null;
let request = 0;
let bound = false;
const listeners = new Set<() => void>();

function publish(update: Partial<MusicSnapshot>) {
  const next = { ...snapshot, ...update };
  if (next.activity === snapshot.activity && next.playing === snapshot.playing && next.unavailable === snapshot.unavailable) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

export function subscribeMusic(listener: () => void) {
  listeners.add(listener);
  bind();
  return () => {
    listeners.delete(listener);
  };
}
export const getMusicSnapshot = () => snapshot;
export const getServerMusicSnapshot = () => SILENT;

function hidden() {
  return typeof document !== "undefined" && document.hidden;
}

function wanted(): boolean {
  return shouldPlayMusic({ pref, sound, activity, videoPlaying, hidden: hidden() });
}

/** Источник по возможностям браузера: ogg, если умеет, иначе m4a. */
function sourceFor(track: MusicTrackId, el: HTMLAudioElement): string {
  const f = MUSIC_FILES[track];
  return el.canPlayType('audio/ogg; codecs="vorbis"') ? f.ogg : f.m4a;
}

function stop() {
  request++;
  audio?.pause();
  publish({ playing: false });
}

/** Привести звук в соответствие с входами: играть или молчать. */
async function reconcile() {
  if (typeof window === "undefined") return;
  if (!wanted() || !activity) {
    stop();
    return;
  }
  const mine = ++request;
  try {
    if (!audio) {
      audio = new Audio();
      audio.loop = true;
      audio.preload = "none";
      audio.volume = VOLUME;
    }
    const src = sourceFor(resolveTrack(pref.track, activity), audio);
    if (audio.error) {
      // после сетевого сбоя элемент «залипает» в ошибке — сбрасываем источник
      audio.removeAttribute("src");
      audio.load();
    }
    if (audio.getAttribute("src") !== src) {
      audio.pause();
      audio.src = src;
    }
    await audio.play();
    if (mine === request && wanted()) publish({ playing: true, unavailable: false });
    else if (!wanted()) audio.pause();
  } catch {
    // автозапуск запрещён или файл не открылся — молча; пробуем при следующем нажатии
    if (mine === request) publish({ playing: false, unavailable: true });
  }
}

function bind() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  document.addEventListener("visibilitychange", () => void reconcile());
  window.addEventListener("pagehide", stop);
  const retry = () => {
    if (wanted() && !snapshot.playing) void reconcile();
  };
  window.addEventListener("pointerdown", retry, { passive: true });
  window.addEventListener("pointerup", retry, { passive: true });
  window.addEventListener("click", retry, { passive: true });
  window.addEventListener("touchend", retry, { passive: true });
  window.addEventListener("keydown", retry);
}

/** Настройка и общий «Звук» из профиля. Вызывает экран-владелец при каждом изменении. */
export function setMusicPref(next: MusicPref, soundOn: boolean) {
  if (pref.enabled === next.enabled && pref.track === next.track && sound === soundOn) return;
  pref = next;
  sound = soundOn;
  void reconcile();
}

/** Экран начался: ему разрешена музыка. Последний вошедший — владелец. */
export function enterMusic(who: symbol, act: MusicActivity) {
  bind();
  owner = who;
  activity = act;
  publish({ activity: act, unavailable: false });
  void reconcile();
}

/** Экран закончился (выход из режима, итоги): музыка останавливается, если владелец тот же. */
export function exitMusic(who: symbol) {
  if (owner !== who) return;
  owner = null;
  activity = null;
  publish({ activity: null });
  stop();
}

/** Видео урока играет — музыка на паузе, закончилось — возвращается. */
export function setMusicVideoPlaying(on: boolean) {
  if (videoPlaying === on) return;
  videoPlaying = on;
  void reconcile();
}

/** Для тестов: полный сброс состояния контроллера. */
export function resetMusicForTests() {
  stop();
  audio = null;
  owner = null;
  activity = null;
  pref = DEFAULT_MUSIC;
  sound = true;
  videoPlaying = false;
  snapshot = SILENT;
}
