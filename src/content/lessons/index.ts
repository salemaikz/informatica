import { INFORMATION_LESSONS } from "./information";
import { LOGIC_LESSONS } from "./logic";
import { PYTHON_LESSONS } from "./python";
import { ALGORITHM_LESSONS } from "./algorithms";
import { COMPUTER_LESSONS } from "./computer-networks";
import { DATA_LESSONS } from "./data-web";
import { MODERN_LESSONS } from "./modern-ent";
import { DEEPENING_LESSONS } from "./deepening";

export const CURRICULUM_LESSONS = [
  ...INFORMATION_LESSONS, ...LOGIC_LESSONS, ...PYTHON_LESSONS, ...ALGORITHM_LESSONS,
  ...COMPUTER_LESSONS, ...DATA_LESSONS, ...MODERN_LESSONS, ...DEEPENING_LESSONS,
];
