import type { Scene } from "@/lib/types";

/** Образцы сцены db-schema. Дополняет исполнитель сцены. */
export const SAMPLES: Extract<Scene, { kind: "db-schema" }>[] = [
  {
    kind: "db-schema",
    tables: [
      { name: "Students", fields: [{ name: "ID", type: "INT", pk: true }, { name: "Name", type: "TEXT" }, { name: "ClassID", type: "INT", fk: "Classes.ID" }] },
      { name: "Classes", fields: [{ name: "ID", type: "INT", pk: true }, { name: "Title", type: "TEXT" }] },
    ],
    highlight: ["Students.ClassID"],
  },
];
