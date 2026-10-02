/* Сервис-воркер Informatica: только напоминания о серии. Страницы не кэшируем (офлайн — позже).
   Простой JS без сборки. Логика напоминаний дублирует src/lib/reminders.ts — совпадение проверяет tests/reminders.test.ts. */

var MIRROR_KEY = "informatica:reminder"; // { enabled, push, time, lang, streak, lastActiveDay, freezes } — пишет ReminderAgent
var REMINDED_KEY = "informatica:reminded"; // день «ГГГГ-ММ-ДД», когда уже напомнили

function p2(n) {
  return n < 10 ? "0" + n : String(n);
}

function dayKey(d) {
  return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
}

function dayDiff(a, b) {
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);
}

function parseTime(time) {
  var m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Серия на сегодня: пропущено больше дней, чем есть заморозок, — 0. */
function liveStreak(m, today) {
  if (!m.lastActiveDay) return 0;
  return dayDiff(m.lastActiveDay, today) - 1 <= (m.freezes || 0) ? m.streak || 0 : 0;
}

function shouldRemindNow(m, now, remindedDay) {
  if (!m || !m.enabled || !m.push) return false;
  var at = parseTime(m.time);
  if (at === null) return false;
  var today = dayKey(now);
  if (m.lastActiveDay === today || remindedDay === today) return false;
  return now.getHours() * 60 + now.getMinutes() >= at;
}

function daysRu(n) {
  var m10 = n % 10;
  var m100 = n % 100;
  var w = m10 === 1 && m100 !== 11 ? "день" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "дня" : "дней";
  return n + " " + w;
}

function reminderText(lang, streak, freezes) {
  var kk = lang === "kk";
  if (streak > 0) {
    return {
      title: kk ? streak + " күндік серия қауіп астында" : "Серия " + daysRu(streak) + " под угрозой",
      body:
        freezes > 0
          ? kk
            ? "Мұздату көмектеседі, бірақ бүгін 5 минут оқыған жөн — серия сақталады"
            : "Заморозка выручит, но лучше 5 минут сегодня — и серия сохранится"
          : kk
            ? "5 минут — және ол сақталады"
            : "5 минут, и она сохранится",
    };
  }
  return {
    title: kk ? "Жаңа серия баста" : "Начни новую серию",
    body: kk ? "Бүгін 5 минут — серияның бірінші күні есептеледі" : "5 минут сегодня — и первый день серии засчитан",
  };
}

// ---------- IndexedDB (та же база, что у idb-keyval: keyval-store / keyval) ----------

function openDb() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open("keyval-store");
    req.onupgradeneeded = function () {
      if (!req.result.objectStoreNames.contains("keyval")) req.result.createObjectStore("keyval");
    };
    req.onsuccess = function () {
      resolve(req.result);
    };
    req.onerror = function () {
      reject(req.error);
    };
  });
}

function idbGet(key) {
  return openDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var req = db.transaction("keyval", "readonly").objectStore("keyval").get(key);
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  });
}

function idbSet(key, value) {
  return openDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction("keyval", "readwrite");
      tx.objectStore("keyval").put(value, key);
      tx.oncomplete = function () {
        resolve();
      };
      tx.onerror = function () {
        reject(tx.error);
      };
    });
  });
}

// ---------- события ----------

function remind() {
  return Promise.all([idbGet(MIRROR_KEY), idbGet(REMINDED_KEY), self.clients.matchAll({ type: "window", includeUncontrolled: true })]).then(function (r) {
    var m = r[0];
    var now = new Date();
    if (!shouldRemindNow(m, now, r[1])) return;
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") return;
    // Приложение открыто и на экране — там свой баннер.
    if (r[2].some(function (c) { return c.visibilityState === "visible"; })) return;
    var text = reminderText(m.lang, liveStreak(m, dayKey(now)), m.freezes || 0);
    return self.registration
      .showNotification(text.title, { body: text.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "streak-reminder", data: { url: "/learn" } })
      .then(function () {
        return idbSet(REMINDED_KEY, dayKey(now));
      });
  });
}

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("periodicsync", function (event) {
  if (event.tag === "streak-reminder") event.waitUntil(remind().catch(function () {}));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "/learn";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("focus" in list[i]) {
          if ("navigate" in list[i] && list[i].url.indexOf(url) === -1) list[i].navigate(url).catch(function () {});
          return list[i].focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
