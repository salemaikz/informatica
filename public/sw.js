/* Сервис-воркер Informatica: напоминания о серии + офлайн-кэш.
   Простой JS без сборки. Логика напоминаний дублирует src/lib/reminders.ts — совпадение проверяет tests/reminders.test.ts.
   Выбор стратегии кэша — функция routeFor (tests/sw.test.ts). Запросы /api/* не трогаем никогда. */

var CACHE_VERSION = "v1";
var CACHE_PREFIX = "informatica-";
// Два кэша: «ядро» (предзагрузка /offline и его скриптов — не вытесняется) и «рабочий» (всё, что открывалось; ограничен по числу записей).
var CORE_CACHE = CACHE_PREFIX + "core-" + CACHE_VERSION;
var RUNTIME_CACHE = CACHE_PREFIX + "rt-" + CACHE_VERSION;
var RUNTIME_MAX = 400; // старые чанки прошлых сборок вытесняются, кэш не растёт бесконечно
var OFFLINE_URL = "/offline";
var PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];
var PAGE_TIMEOUT_MS = 4000;
// Версия воркера в режиме разработки (?mode=notify) только показывает уведомления: кэш dev-чанков (без хэшей) устарел бы сразу.
var NOTIFY_ONLY = typeof self.location !== "undefined" && /[?&]mode=notify\b/.test(String(self.location.search || ""));

/** Какая стратегия для запроса: "ignore" | "static" (cache-first) | "page" (network-first → кэш → /offline) | "swr" (stale-while-revalidate). */
function routeFor(req, origin) {
  if (!req || req.method !== "GET") return "ignore";
  var url;
  try {
    url = new URL(req.url, origin);
  } catch {
    return "ignore";
  }
  if (url.origin !== origin) return "ignore";
  var path = url.pathname;
  if (path === "/api" || path.indexOf("/api/") === 0) return "ignore";
  if (path === "/sw.js") return "ignore";
  var headers = req.headers && typeof req.headers.get === "function" ? req.headers : null;
  // Запросы с Range (аудио/видео) — мимо: частичные ответы (206) не кэшируются, а полный ответ из кэша ломает перемотку.
  if (headers && headers.get("Range")) return "ignore";
  if (path.indexOf("/_next/static/") === 0) return "static";
  if (req.mode === "navigate") return "page";
  // Клиентские переходы Next (RSC-данные) идут в сеть как есть: их кэш мог бы подмешать данные в HTML-страницу.
  if ((headers && headers.get("RSC")) || url.searchParams.has("_rsc")) return "ignore";
  return "swr";
}

function cacheable(res) {
  return !!res && res.status === 200 && res.type === "basic" && !res.redirected;
}

/** Удаляет самые старые записи рабочего кэша сверх лимита. */
function trimRuntime(cache) {
  return cache.keys().then(function (keys) {
    var extra = keys.length - RUNTIME_MAX;
    if (extra <= 0) return;
    return Promise.all(
      keys.slice(0, extra).map(function (k) {
        return cache.delete(k);
      }),
    );
  });
}

function putCache(key, res) {
  return caches.open(RUNTIME_CACHE).then(function (c) {
    return c.put(key, res).then(function () {
      return trimRuntime(c);
    });
  });
}

/**
 * Сеть + запись в кэш. Запись регистрируется в event.waitUntil СИНХРОННО (до respondWith):
 * если звать waitUntil позже, когда ответ уже отдан из кэша, браузер бросит InvalidStateError и кэш не обновится.
 */
function fetchAndCache(event, key) {
  var net = fetch(event.request);
  event.waitUntil(
    net
      .then(function (res) {
        if (cacheable(res)) return putCache(key, res.clone());
      })
      .catch(function () {}),
  );
  return net;
}

function cacheFirst(event) {
  return caches.match(event.request).then(function (hit) {
    if (hit) return hit;
    return fetch(event.request).then(function (res) {
      // Здесь respondWith ещё ждёт ответа — waitUntil вызывать можно.
      if (cacheable(res)) event.waitUntil(putCache(event.request, res.clone()).catch(function () {}));
      return res;
    });
  });
}

function pageStrategy(event) {
  var key = event.request.url;
  var netSafe = fetchAndCache(event, key).catch(function () {
    return null;
  });
  var timer;
  var timeout = new Promise(function (resolve) {
    timer = setTimeout(function () {
      resolve(null);
    }, PAGE_TIMEOUT_MS);
  });
  return Promise.race([netSafe, timeout]).then(function (res) {
    clearTimeout(timer);
    if (res) return res;
    return caches.match(key).then(function (hit) {
      if (hit) return hit;
      // Кэша нет: ждём сеть до конца, а если её нет — страница «Нет интернета» (корень сайта — это /learn).
      return netSafe.then(function (r) {
        if (r) return r;
        var path = new URL(key).pathname;
        return (path === "/" ? caches.match("/learn") : Promise.resolve(null)).then(function (home) {
          return home || caches.match(OFFLINE_URL).then(function (off) {
            return off || Response.error();
          });
        });
      });
    });
  });
}

function staleWhileRevalidate(event) {
  var fresh = fetchAndCache(event, event.request).catch(function () {
    return null;
  });
  return caches.match(event.request).then(function (hit) {
    return (
      hit ||
      fresh.then(function (r) {
        return r || Response.error();
      })
    );
  });
}

/** Кладёт в «ядро» /offline и скрипты, которые эта страница подгружает, — чтобы она открывалась без сети. */
function precache() {
  return caches.open(CORE_CACHE).then(function (cache) {
    var jobs = PRECACHE.filter(function (u) {
      return u !== OFFLINE_URL;
    }).map(function (u) {
      return cache.add(u).catch(function () {});
    });
    jobs.push(
      fetch(OFFLINE_URL)
        .then(function (res) {
          if (!cacheable(res)) return;
          return Promise.all([res.clone().text(), cache.put(OFFLINE_URL, res)]).then(function (r) {
            var urls = {};
            (r[0].match(/\/_next\/static\/[^"'\s\\)]+/g) || []).forEach(function (u) {
              urls[u] = true;
            });
            return Promise.all(
              Object.keys(urls).map(function (u) {
                return cache.add(u).catch(function () {});
              }),
            );
          });
        })
        .catch(function () {}),
    );
    return Promise.all(jobs);
  });
}

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
            ? "Бар болғаны 5 минут — серия сақталады"
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

self.addEventListener("install", function (event) {
  self.skipWaiting();
  if (!NOTIFY_ONLY) event.waitUntil(precache());
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k.indexOf(CACHE_PREFIX) === 0 && k !== CORE_CACHE && k !== RUNTIME_CACHE;
            })
            .map(function (k) {
              return caches.delete(k);
            }),
        );
      })
      .catch(function () {})
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", function (event) {
  if (NOTIFY_ONLY) return;
  var route = routeFor(event.request, self.location.origin);
  if (route === "ignore") return;
  event.respondWith(route === "static" ? cacheFirst(event) : route === "page" ? pageStrategy(event) : staleWhileRevalidate(event));
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
