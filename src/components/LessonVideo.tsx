"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

const YT_SCRIPT_ID = "youtube-iframe-api";

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.YT?.Player) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const existing = document.getElementById(YT_SCRIPT_ID);
    if (existing) {
      const prior = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prior?.();
        resolve();
      };
      return;
    }

    window.onYouTubeIframeAPIReady = () => resolve();
    const script = document.createElement("script");
    script.id = YT_SCRIPT_ID;
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.body.appendChild(script);
  });
}

type LessonVideoProps = {
  youtubeId: string;
  title: string;
  onWatched: () => void;
  watched: boolean;
};

export function LessonVideo({ youtubeId, title, onWatched, watched }: LessonVideoProps) {
  const reactId = useId();
  const containerId = `yt-player-${reactId.replace(/:/g, "")}`;
  const playerRef = useRef<YT.Player | null>(null);
  const endedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const handleWatched = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    onWatched();
  }, [onWatched]);

  useEffect(() => {
    endedRef.current = watched;
  }, [watched]);

  useEffect(() => {
    endedRef.current = false;
    setUnavailable(false);
    setReady(false);
  }, [youtubeId]);

  useEffect(() => {
    if (unavailable) return;

    let cancelled = false;

    async function mount() {
      playerRef.current?.destroy();
      playerRef.current = null;

      try {
        await loadYouTubeIframeApi();
        if (cancelled || !window.YT?.Player) return;

        playerRef.current = new window.YT.Player(containerId, {
          videoId: youtubeId,
          width: "100%",
          height: "100%",
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              if (!cancelled) setReady(true);
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.ENDED) {
                handleWatched();
              }
            },
            onError: () => {
              if (cancelled) return;
              playerRef.current?.destroy();
              playerRef.current = null;
              setUnavailable(true);
            },
          },
        });
      } catch {
        if (!cancelled) {
          setUnavailable(true);
        }
      }
    }

    mount();

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [youtubeId, containerId, handleWatched, unavailable]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900">
        {unavailable ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm font-medium text-zinc-200">Video unavailable</p>
            <p className="text-xs text-zinc-500">
              This lesson video cannot be played here. You can still continue with{" "}
              <span className="text-zinc-400">I watched it</span> below.
            </p>
          </div>
        ) : (
          <>
            <div id={containerId} className="absolute inset-0 h-full w-full" title={title} />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
                Loading video…
              </div>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={handleWatched}
        disabled={watched}
        className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition enabled:hover:bg-blue-500 disabled:cursor-default disabled:bg-zinc-700 disabled:text-zinc-400"
      >
        {watched ? "Marked as watched" : "I watched it"}
      </button>
    </div>
  );
}
