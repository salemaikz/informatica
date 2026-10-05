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
import { AccessPointArt, CableFiberArt, CableUtpArt, HubArt, ModemArt, NicArt, SwitchArt } from "./devices/network";
import { PenTabletArt, PlotterArt, PrinterDotArt, PrinterInkjetArt, PrinterLaserArt } from "./devices/print";
import { DroneArt, ManipulatorArt, RobotVacuumArt, SensorArt, VrHeadsetArt } from "./devices/robots";

/** Устройства ввода/вывода и «компьютеры вокруг нас» (рисует A2, детали и носители — в internals.tsx). */
export const DEVICE_IDS = [
  // ввод
  "keyboard", "mouse", "touchpad", "touchscreen", "mic", "webcam", "scanner", "gamepad",
  // вывод
  "monitor", "printer", "speakers", "headphones", "projector",
  // компьютеры вокруг нас
  "desktop", "laptop", "phone", "tablet", "smartwatch", "atm", "pos", "car", "server", "router",
  // сеть, печать, ввод, роботы (волна 3)
  "switch", "hub", "modem", "access-point", "nic", "cable-utp", "cable-fiber",
  "printer-dot", "printer-inkjet", "printer-laser", "plotter", "pen-tablet",
  "sensor", "vr-headset", "robot-vacuum", "drone", "manipulator",
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
  switch: SwitchArt,
  hub: HubArt,
  modem: ModemArt,
  "access-point": AccessPointArt,
  nic: NicArt,
  "cable-utp": CableUtpArt,
  "cable-fiber": CableFiberArt,
  "printer-dot": PrinterDotArt,
  "printer-inkjet": PrinterInkjetArt,
  "printer-laser": PrinterLaserArt,
  plotter: PlotterArt,
  "pen-tablet": PenTabletArt,
  sensor: SensorArt,
  "vr-headset": VrHeadsetArt,
  "robot-vacuum": RobotVacuumArt,
  drone: DroneArt,
  manipulator: ManipulatorArt,
};
