"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Dictionary, format } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { CARD_THEMES, type CardTheme, type Palette } from "@/lib/palette";
import type { MediaEvent, MediaEventRequest, MediaInfo, ResolveResponse } from "@/lib/types";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; info: MediaInfo; palette: Palette };

const LIGHT_TINT = { background: "#f4f1ea", foreground: "#141414" };
const DARK_TINT = { background: "#111013", foreground: "#ffffff" };

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

async function errorMessage(res: Response, t: Dictionary): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? format(t.notices.httpError, { status: res.status });
  } catch {
    return format(t.notices.httpError, { status: res.status });
  }
}

/** Fire and forget: popularity stats must never get in the way of the card. */
function track(event: MediaEventRequest) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {});
}

/** Lucide clipboard-paste. */
function ClipboardPaste() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z" />
      <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M21 14H11" />
      <path d="m15 10-4 4 4 4" />
    </svg>
  );
}

function slugify(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "card"
  );
}

export function ShareForm({
  initialInput,
  services,
  locale,
  t,
}: {
  initialInput: string;
  services: string[];
  locale: Locale;
  t: Dictionary;
}) {
  const [input, setInput] = useState(initialInput);
  const [state, setState] = useState<State>({ status: "idle" });
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("");
  const [artists, setArtists] = useState("");
  const [theme, setTheme] = useState<CardTheme>("auto");
  const [loadedSrc, setLoadedSrc] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const scrollOnReady = useRef(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [canCopyImage, setCanCopyImage] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(0);

  const debouncedTitle = useDebounced(title, 450);
  const debouncedArtists = useDebounced(artists, 450);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  useEffect(() => {
    try {
      const probe = new File([new Blob()], "probe.png", { type: "image/png" });
      setCanShareFiles(typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
    } catch {
      setCanShareFiles(false);
    }
    setCanCopyImage(typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write);
  }, []);

  const info = state.status === "ready" ? state.info : null;
  const isPlaylist = info?.kind === "playlist";

  const { cardPath, edited } = useMemo(() => {
    if (!info) return { cardPath: "", edited: false };
    const p = new URLSearchParams({ url: info.url, lang: locale, theme });
    const nextTitle = debouncedTitle.trim();
    if (nextTitle && nextTitle !== info.title) p.set("title", nextTitle);
    const original = (isPlaylist ? info.curator ?? "" : info.artists.join(", ")).trim();
    if (debouncedArtists.trim() !== original) {
      p.set(isPlaylist ? "curator" : "artists", debouncedArtists.trim());
    }
    return { cardPath: "/api/card?" + p.toString(), edited: p.has("title") || p.has("artists") || p.has("curator") };
  }, [info, isPlaylist, locale, theme, debouncedTitle, debouncedArtists]);

  // Derived, not stored: an effect that switched it on could lose the race with a
  // cached image whose load event had already fired, leaving the spinner on forever.
  const imageLoading = cardPath !== "" && loadedSrc !== cardPath;

  // A cached image can finish before React attaches onLoad, so check on mount too.
  useEffect(() => {
    const node = imgRef.current;
    if (node?.complete && node.naturalWidth > 0) setLoadedSrc(cardPath);
  }, [cardPath]);

  // On a narrow screen the preview sits below the form, so bring it into view.
  // Only after a new link is resolved: edits must not pull the field being typed in away.
  useEffect(() => {
    if (state.status !== "ready" || !scrollOnReady.current) return;
    scrollOnReady.current = false;
    const target = previewRef.current;
    if (!target || !window.matchMedia("(max-width: 860px)").matches) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });

    // Some browsers ignore smooth scrolling, so jump if the preview is still
    // not near the top. A short page may not scroll that far, which is fine.
    const id = window.setTimeout(() => {
      const { top } = target.getBoundingClientRect();
      if (top < 0 || top > window.innerHeight / 2) target.scrollIntoView({ block: "start" });
    }, 350);
    return () => window.clearTimeout(id);
  }, [state]);

  // Paint the page with the colors of the card.
  useEffect(() => {
    const root = document.documentElement;
    if (state.status !== "ready") {
      root.style.removeProperty("--tint-bg");
      root.style.removeProperty("--tint-ink");
      return;
    }
    const palette = theme === "auto" ? state.palette : theme === "light" ? LIGHT_TINT : DARK_TINT;
    root.style.setProperty("--tint-bg", palette.background);
    root.style.setProperty("--tint-ink", palette.foreground);
  }, [state, theme]);

  const create = useCallback(
    async (link: string) => {
      const value = link.trim();
      if (!value) return;
      setNotice("");
      setState({ status: "loading" });
      try {
        const res = await fetch("/api/resolve?url=" + encodeURIComponent(value) + "&lang=" + locale);
        if (!res.ok) throw new Error(await errorMessage(res, t));
        const body = (await res.json()) as ResolveResponse;
        setTitle(body.info.title);
        setArtists(body.info.kind === "playlist" ? body.info.curator ?? "" : body.info.artists.join(", "));
        setTheme("auto");
        scrollOnReady.current = true;
        setState({ status: "ready", info: body.info, palette: body.palette });
        track({ url: body.info.url, type: "created", theme: "auto", edited: false });
      } catch (err) {
        setState({ status: "error", message: err instanceof Error ? err.message : t.notices.unexpected });
      }
    },
    [locale, t],
  );

  // Links shared into the installed app arrive as ?url= / ?text=.
  useEffect(() => {
    if (initialInput) void create(initialInput);
  }, [initialInput, create]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void create(input);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
      void create(text);
    } catch {
      setNotice(t.notices.clipboardBlocked);
    }
  };

  const filename = "trackshare-" + slugify(artists + " " + title) + ".png";

  const getBlob = async () => {
    const res = await fetch(cardPath);
    if (!res.ok) throw new Error(await errorMessage(res, t));
    return res.blob();
  };

  const trackExport = (type: MediaEvent) => {
    if (info) track({ url: info.url, type, theme, edited });
  };

  const download = async () => {
    try {
      const url = URL.createObjectURL(await getBlob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      trackExport("download");
    } catch {
      setNotice(t.notices.unexpected);
    }
  };

  const share = async () => {
    try {
      const file = new File([await getBlob()], filename, { type: "image/png" });
      await navigator.share({ files: [file], title });
      trackExport("share");
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") setNotice(t.notices.shareFailed);
    }
  };

  const copyImage = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": await getBlob() })]);
      trackExport("copy");
      setNotice("");
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice(t.notices.copyFailed);
    }
  };

  const reset = () => {
    if (!info) return;
    setTitle(info.title);
    setArtists(isPlaylist ? info.curator ?? "" : info.artists.join(", "));
    setTheme("auto");
  };

  const busy = state.status === "loading";
  const titleLabel = !info
    ? t.editor.title
    : info.kind === "track"
      ? t.editor.trackName
      : info.kind === "album"
        ? t.editor.albumName
        : t.editor.playlistName;
  const themeLabel: Record<CardTheme, string> = {
    auto: t.editor.themeAuto,
    light: t.editor.themeLight,
    dark: t.editor.themeDark,
  };
  const altText = info
    ? format(artists ? t.alt.cardWithArtists : t.alt.card, {
        kind: t.kinds[info.kind],
        title,
        artists,
      })
    : "";

  return (
    <div className="layout">
      <section>
        <h1>{t.home.heading}</h1>
        <p className="lede">{t.home.lede}</p>

        <form onSubmit={onSubmit}>
          <label className="label" htmlFor="link">
            {t.home.linkLabel}
          </label>
          <div className="field">
            <input
              id="link"
              className="input"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={t.home.linkPlaceholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              required
            />
            <button className="btn btn-icon" type="button" onClick={pasteFromClipboard} disabled={busy}>
              <ClipboardPaste />
              {t.home.paste}
            </button>
          </div>
          <button className="btn btn-primary btn-submit" type="submit" disabled={busy}>
            {busy ? t.home.submitBusy : t.home.submit}
          </button>
        </form>

        <p className={"status" + (state.status === "error" ? " error" : "")} role="status" aria-live="polite">
          {state.status === "error" ? state.message : notice}
        </p>

        {info ? (
          <section className="editor" aria-label={t.editor.heading}>
            <div className="editor-field">
              <label className="label" htmlFor="card-title">
                {titleLabel}
              </label>
              <input
                id="card-title"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="editor-field">
              <label className="label" htmlFor="card-artists">
                {isPlaylist ? t.editor.madeBy : t.editor.artists}
              </label>
              <input
                id="card-artists"
                className="input"
                value={artists}
                onChange={(e) => setArtists(e.target.value)}
                maxLength={200}
              />
            </div>

            <fieldset className="themes">
              <legend className="label">{t.editor.colors}</legend>
              {CARD_THEMES.map((value) => (
                <label key={value} className="chip">
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={theme === value}
                    onChange={() => setTheme(value)}
                  />
                  <span>{themeLabel[value]}</span>
                </label>
              ))}
            </fieldset>

            <button className="btn btn-quiet" type="button" onClick={reset}>
              {t.editor.reset}
            </button>
          </section>
        ) : (
          <p className="services">{format(t.home.worksWith, { services: services.join(" · ") })}</p>
        )}
      </section>

      <section className="preview" aria-label={t.home.previewLabel} ref={previewRef}>
        <div className={"frame" + (imageLoading ? " is-loading" : "")}>
          {cardPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={cardPath}
              alt={altText}
              width={1080}
              height={1080}
              onLoad={() => setLoadedSrc(cardPath)}
              onError={() => {
                setLoadedSrc(cardPath);
                setNotice(t.notices.unexpected);
              }}
            />
          ) : null}
          {cardPath && imageLoading && (
            <div className="frame-spinner">
              <span>
                <span className="spinner" role="img" aria-label={t.home.creatingImage} />
              </span>
            </div>
          )}
          {!cardPath &&
            (busy ? (
              <div className="spinner" role="img" aria-label={t.home.creatingImage} />
            ) : (
              <div className="placeholder">{t.home.placeholder}</div>
            ))}
        </div>

        {info && (
          <div className="actions">
            <button className="btn btn-primary" type="button" onClick={download}>
              {t.home.download}
            </button>
            {canShareFiles && (
              <button className="btn" type="button" onClick={share}>
                {t.home.share}
              </button>
            )}
            {canCopyImage && (
              <button
                className={"btn btn-copy" + (copied ? " is-copied" : "")}
                type="button"
                onClick={copyImage}
              >
                <span className="btn-copy-label" aria-hidden={copied}>
                  {t.home.copyImage}
                </span>
                <span className="btn-copy-done" aria-hidden={!copied}>
                  <svg
                    className="btn-copy-check"
                    width={17}
                    height={17}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {t.home.copied}
                </span>
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
