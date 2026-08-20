"use client";

import { useEffect, useRef, useState } from "react";

type Video = {
  id: number;
  title: string;
  youtube_url: string;
  youtube_id: string;
  thumbnail_url: string | null;
  description: string | null;
  category: string | null;
  created_at: string;
  added_by_name: string | null;
};

type Preview = { youtubeId: string; title: string | null; thumbnailUrl: string; authorName: string | null };

export default function TrainingClient({ canManage }: { canManage: boolean }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<Video | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    const res = await fetch("/api/training");
    if (res.ok) {
      const data = await res.json();
      setVideos(data.videos);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fetch on mount
    load();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Both the "clear" and "fetch" paths run inside the timeout callback
    // (never synchronously in the effect body) so a debounced link-preview
    // stays a single, consistent async flow.
    debounceRef.current = setTimeout(
      async () => {
        if (!url.trim()) {
          setPreview(null);
          setPreviewError("");
          return;
        }
        setPreviewLoading(true);
        setPreviewError("");
        try {
          const res = await fetch(`/api/training/preview?url=${encodeURIComponent(url.trim())}`);
          const data = await res.json();
          if (!res.ok) {
            setPreview(null);
            setPreviewError(data.error ?? "Не удалось распознать ссылку");
          } else {
            setPreview(data);
            if (!title && data.title) setTitle(data.title);
          }
        } catch {
          setPreview(null);
          setPreviewError("Не удалось загрузить превью");
        }
        setPreviewLoading(false);
      },
      url.trim() ? 500 : 0
    );

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced on url only; title is read, not a trigger
  }, [url]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title || preview?.title || "Без названия", youtubeUrl: url, category, description }),
    });
    if (res.ok) {
      setUrl("");
      setTitle("");
      setCategory("");
      setDescription("");
      setPreview(null);
      setShowForm(false);
      load();
    }
    setSaving(false);
  }

  async function remove(id: number) {
    if (!confirm("Удалить это видео из библиотеки?")) return;
    await fetch(`/api/training/${id}`, { method: "DELETE" });
    load();
  }

  const categories = [...new Set(videos.map((v) => v.category).filter(Boolean))] as string[];

  if (loading) return <p className="mt-6 text-gray-500">Загрузка...</p>;

  return (
    <div>
      {canManage && (
        <div className="mt-6">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              + Добавить видео
            </button>
          ) : (
            <form onSubmit={save} className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
              <label className="block text-xs text-gray-500">Ссылка на YouTube</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
                autoFocus
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />

              {previewLoading && <p className="mt-2 text-xs text-gray-400">Загружаю превью...</p>}
              {previewError && <p className="mt-2 text-xs text-red-600">{previewError}</p>}
              {preview && (
                <div className="mt-3 flex gap-3 rounded-lg bg-gray-50 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.thumbnailUrl} alt="" className="h-16 w-28 rounded object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{preview.title ?? "Без названия"}</p>
                    {preview.authorName && <p className="text-xs text-gray-400">{preview.authorName}</p>}
                  </div>
                </div>
              )}

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-gray-500">Название (можно поправить)</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Подтянется из YouTube"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">Категория (необязательно)</label>
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Онбординг, Таргет, CRM..."
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-xs text-gray-500">Описание (необязательно)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={saving || !url}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? "Сохраняю..." : "Сохранить"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setUrl("");
                    setTitle("");
                    setCategory("");
                    setDescription("");
                    setPreview(null);
                  }}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {videos.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">Пока нет ни одного видео.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {(categories.length > 0 ? [...categories, null] : [null]).map((cat) => {
            const group = videos.filter((v) => (cat === null ? !v.category : v.category === cat));
            if (group.length === 0) return null;
            return (
              <div key={cat ?? "__uncategorized"}>
                {cat && <h2 className="mb-3 text-sm font-semibold text-gray-500">{cat}</h2>}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((v) => (
                    <div key={v.id} className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                      <button onClick={() => setPlaying(v)} className="block w-full">
                        <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={v.thumbnail_url ?? ""}
                            alt={v.title}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 opacity-0 shadow transition-opacity group-hover:opacity-100">
                              <div className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-red-600" />
                            </div>
                          </div>
                        </div>
                      </button>
                      <div className="p-3">
                        <p className="line-clamp-2 text-sm font-medium">{v.title}</p>
                        {v.added_by_name && <p className="mt-1 text-xs text-gray-400">Добавил: {v.added_by_name}</p>}
                        {canManage && (
                          <button
                            onClick={() => remove(v.id)}
                            className="mt-2 text-xs text-gray-400 underline hover:text-red-600"
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {playing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPlaying(null)}
        >
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${playing.youtube_id}?autoplay=1`}
                title={playing.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
            <div className="mt-3 flex items-start justify-between">
              <div>
                <p className="font-medium text-white">{playing.title}</p>
                {playing.description && <p className="mt-1 text-sm text-gray-300">{playing.description}</p>}
              </div>
              <button onClick={() => setPlaying(null)} className="text-sm text-gray-300 hover:text-white">
                Закрыть ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
