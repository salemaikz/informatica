"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { SceneView } from "@/components/scenes/SceneView";
import { SCENE_SAMPLES } from "@/components/scenes/samples";
import { useApp } from "@/lib/store";

/** ?group=chart — только одна группа; ?lang=kk — казахские подписи; ?theme=dark — тёмная тема. */
export function SceneGallery() {
  const params = useSearchParams();
  const group = params.get("group");
  const lang = params.get("lang") === "kk" ? "kk" : "ru";
  const theme = params.get("theme");
  const updateProfile = useApp((s) => s.updateProfile);
  useEffect(() => {
    updateProfile({ lang, ...(theme === "dark" || theme === "light" ? { theme } : {}) });
  }, [lang, theme, updateProfile]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6">
      {SCENE_SAMPLES.filter((g) => !group || g.group === group).map((g) => (
        <section key={g.group} data-group={g.group} className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold">{g.group}</h2>
          {g.scenes.map((scene, i) => (
            <div key={i} data-sample={`${g.group}-${i}`}>
              <SceneView scene={scene} />
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
