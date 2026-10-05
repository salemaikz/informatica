import type { Scene } from "@/lib/types";

/** Образцы сцены db-schema: 1:N, N:M через связку, четыре таблицы, 1:1, самосвязь, две связи в один ключ, длинные подписи, одна таблица. */
export const SAMPLES: Extract<Scene, { kind: "db-schema" }>[] = [
  {
    kind: "db-schema",
    tables: [
      { name: "Students", fields: [{ name: "ID", type: "INT", pk: true }, { name: "Name", type: "TEXT" }, { name: "ClassID", type: "INT", fk: "Classes.ID" }] },
      { name: "Classes", fields: [{ name: "ID", type: "INT", pk: true }, { name: "Title", type: "TEXT" }] },
    ],
    highlight: ["Students.ClassID"],
  },
  // N:M через таблицу-связку: сверху справочники, снизу связка с двумя внешними ключами.
  {
    kind: "db-schema",
    tables: [
      { name: "Students", fields: [{ name: "ID", type: "INT", pk: true }, { name: "Name", type: "TEXT" }] },
      { name: "Enrollments", fields: [{ name: "ID", type: "INT", pk: true }, { name: "StudentID", type: "INT", fk: "Students.ID" }, { name: "CourseID", type: "INT", fk: "Courses.ID" }, { name: "Grade", type: "INT" }] },
      { name: "Courses", fields: [{ name: "ID", type: "INT", pk: true }, { name: "Title", type: "TEXT" }, { name: "Hours", type: "INT" }] },
    ],
    highlight: ["Enrollments"],
    caption: { ru: "Многие ко многим: связка хранит два внешних ключа", kk: "Көпке-көп: байланыстырушы кестеде екі сыртқы кілт бар" },
  },
  // Четыре таблицы, пять связей: диагональ и «колонка» (OrderItems → Orders).
  {
    kind: "db-schema",
    tables: [
      { name: "Customers", fields: [{ name: "ID", type: "INT", pk: true }, { name: "Name", type: "TEXT" }, { name: "City", type: "TEXT" }] },
      { name: "Orders", fields: [{ name: "ID", type: "INT", pk: true }, { name: "CustomerID", type: "INT", fk: "Customers.ID" }, { name: "OrderDate", type: "DATE" }] },
      { name: "Products", fields: [{ name: "ID", type: "INT", pk: true }, { name: "Title", type: "TEXT" }, { name: "Price", type: "REAL" }] },
      { name: "OrderItems", fields: [{ name: "ID", type: "INT", pk: true }, { name: "OrderID", type: "INT", fk: "Orders.ID" }, { name: "ProductID", type: "INT", fk: "Products.ID" }, { name: "Qty", type: "INT" }] },
    ],
    highlight: ["OrderItems.OrderID", "Orders.ID"],
  },
  // 1:1 — подписи «1» у обоих концов.
  {
    kind: "db-schema",
    tables: [
      { name: "Users", fields: [{ name: "ID", type: "INT", pk: true }, { name: "Login", type: "TEXT" }] },
      { name: "Profiles", fields: [{ name: "UserID", type: "INT", pk: true, fk: "Users.ID" }, { name: "Bio", type: "TEXT" }, { name: "Avatar", type: "TEXT" }] },
    ],
    cards: [{ field: "Profiles.UserID", card: "1:1" }],
    highlight: ["Profiles"],
  },
  // Самосвязь: одна таблица ссылается на свой же ключ.
  {
    kind: "db-schema",
    tables: [{ name: "Employees", fields: [{ name: "ID", type: "INT", pk: true }, { name: "Name", type: "TEXT" }, { name: "ManagerID", type: "INT", fk: "Employees.ID" }] }],
  },
  // Два внешних ключа в один первичный (рейс: откуда и куда).
  {
    kind: "db-schema",
    tables: [
      { name: "Airports", fields: [{ name: "ID", type: "INT", pk: true }, { name: "City", type: "TEXT" }] },
      { name: "Flights", fields: [{ name: "ID", type: "INT", pk: true }, { name: "FromID", type: "INT", fk: "Airports.ID" }, { name: "ToID", type: "INT", fk: "Airports.ID" }] },
    ],
    highlight: ["Flights.ToID"],
  },
  // Худший случай: казахские имена таблиц и полей, максимум полей (7), длинные «имя + тип» (22 символа).
  {
    kind: "db-schema",
    tables: [
      {
        name: "Оқушылар",
        fields: [
          { name: "Коды", type: "INT", pk: true },
          { name: "Аты-жөні", type: "TEXT" },
          { name: "Туған күні", type: "DATE" },
          { name: "Сынып коды", type: "INT", fk: "Сыныптар.Коды" },
          { name: "Телефон", type: "VARCHAR(20)" },
          { name: "Мекенжай", type: "TEXT" },
          { name: "Орташа балл", type: "REAL" },
        ],
      },
      { name: "Сыныптар", fields: [{ name: "Коды", type: "INT", pk: true }, { name: "Аталуы", type: "TEXT" }, { name: "Жетекші", type: "TEXT" }] },
    ],
    highlight: ["Оқушылар.Сынып коды"],
  },
  // Одна таблица без связей: подсвечено поле.
  {
    kind: "db-schema",
    tables: [{ name: "Books", fields: [{ name: "ID", type: "INT", pk: true }, { name: "Title", type: "TEXT" }, { name: "Author", type: "TEXT" }, { name: "Year", type: "INT" }] }],
    highlight: ["Books.ID"],
  },
];
