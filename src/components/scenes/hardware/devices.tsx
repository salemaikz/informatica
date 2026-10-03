import type { ReactElement } from "react";
import type { HardwareId } from "@/lib/types";
import { GamepadArt, KeyboardArt, MicArt, MouseArt, ScannerArt, TouchpadArt, TouchscreenArt, WebcamArt } from "./devices/input";
import { HeadphonesArt, MonitorArt, PrinterArt, ProjectorArt, SpeakersArt } from "./devices/output";
import {
  AtmArt,
  CarArt,
  DesktopArt,
  LaptopArt,
  PhoneArt,
  PosArt,
  RouterArt,
  ServerArt,
  SmartwatchArt,
  TabletArt,
} from "./devices/around";

/** Устройства ввода/вывода и «компьютеры вокруг нас» (рисует A2, детали и носители — в internals.tsx). */
export const DEVICE_IDS = [
  // ввод
  "keyboard", "mouse", "touchpad", "touchscreen", "mic", "webcam", "scanner", "gamepad",
  // вывод
  "monitor", "printer", "speakers", "headphones", "projector",
  // компьютеры вокруг нас
  "desktop", "laptop", "phone", "tablet", "smartwatch", "atm", "pos", "car", "server", "router",
] as const satisfies readonly HardwareId[];

export type DeviceId = (typeof DEVICE_IDS)[number];

// Каждая функция возвращает <svg> c viewBox="0 0 120 90" (плоская иллюстрация, цвета — токены темы).
export const DEVICE_ART: Record<DeviceId, () => ReactElement> = {
  keyboard: KeyboardArt,
  mouse: MouseArt,
  touchpad: TouchpadArt,
  touchscreen: TouchscreenArt,
  mic: MicArt,
  webcam: WebcamArt,
  scanner: ScannerArt,
  gamepad: GamepadArt,
  monitor: MonitorArt,
  printer: PrinterArt,
  speakers: SpeakersArt,
  headphones: HeadphonesArt,
  projector: ProjectorArt,
  desktop: DesktopArt,
  laptop: LaptopArt,
  phone: PhoneArt,
  tablet: TabletArt,
  smartwatch: SmartwatchArt,
  atm: AtmArt,
  pos: PosArt,
  car: CarArt,
  server: ServerArt,
  router: RouterArt,
};
