import { loadEnv } from "./load-env";
import {
  findCandidatesForLesson,
  formatDuration,
  validateVideoId,
} from "../src/lib/youtube/data-api";
import {
  loadSeedFile,
  saveSeedFile,
  type SeedLesson,
  type VideoCandidate,
  watchUrl,
} from "../src/lib/seed-lesson";

loadEnv();

const force = process.argv.includes("--force");

function toCandidate(details: {
  id: string;
  title: string;
  channel: string;
  duration: string;
  durationSeconds: number;
}): VideoCandidate {
  return {
    youtubeId: details.id,
    title: details.title,
    channelTitle: details.channel,
    duration: details.duration,
    durationSeconds: details.durationSeconds,
  };
}

function applyPrimary(lesson: SeedLesson, primary: VideoCandidate, alternates: VideoCandidate[]): void {
  lesson.youtubeId = primary.youtubeId;
  lesson.videoUrl = watchUrl(primary.youtubeId);
  lesson.videoTitle = primary.title;
  lesson.videoChannel = primary.channelTitle;
  lesson.videoDuration = primary.duration;
  lesson.videoDurationSeconds = primary.durationSeconds;
  lesson.videoAlternates = alternates;
}

type Row = {
  lessonId: string;
  action: string;
  youtubeId: string;
  title: string;
  channel: string;
  duration: string;
};

async function main() {
  const data = loadSeedFile();
  const rows: Row[] = [];

  for (const lesson of data.lessons) {
    const currentId = lesson.youtubeId;
    if (!force) {
      const validation = await validateVideoId(currentId);
      if (validation.ok) {
        rows.push({
          lessonId: lesson.id,
          action: "skipped (valid)",
          youtubeId: currentId,
          title: lesson.videoTitle ?? validation.details?.title ?? "",
          channel: lesson.videoChannel ?? validation.details?.channel ?? "",
          duration: lesson.videoDurationSeconds
            ? formatDuration(lesson.videoDurationSeconds)
            : validation.details
              ? formatDuration(validation.details.durationSeconds)
              : "",
        });
        continue;
      }
    }

    const candidates = await findCandidatesForLesson(lesson.title, lesson.topicTags);
    if (candidates.length === 0) {
      rows.push({
        lessonId: lesson.id,
        action: "no candidates",
        youtubeId: currentId,
        title: "",
        channel: "",
        duration: "",
      });
      continue;
    }

    const mapped = candidates.map(toCandidate);
    const [primary, ...rest] = mapped;
    const alternates = rest.slice(0, 2);
    applyPrimary(lesson, primary, alternates);

    rows.push({
      lessonId: lesson.id,
      action: force ? "replaced (--force)" : "updated",
      youtubeId: primary.youtubeId,
      title: primary.title,
      channel: primary.channelTitle,
      duration: formatDuration(primary.durationSeconds),
    });
  }

  saveSeedFile(data);

  console.log("\nfind-videos summary\n");
  console.table(rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
