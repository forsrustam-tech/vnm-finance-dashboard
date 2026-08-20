import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { extractYoutubeId, youtubeThumbnail } from "@/lib/youtube";

// Server-side proxy for YouTube's public oEmbed endpoint — used to show a
// live title/thumbnail preview while the user is pasting a link, before
// they save anything.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Нет ссылки" }, { status: 400 });

  const youtubeId = extractYoutubeId(url);
  if (!youtubeId) return NextResponse.json({ error: "Не удалось распознать ссылку YouTube" }, { status: 400 });

  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    if (!oembedRes.ok) throw new Error(String(oembedRes.status));
    const data = await oembedRes.json();
    return NextResponse.json({
      youtubeId,
      title: data.title as string,
      thumbnailUrl: youtubeThumbnail(youtubeId),
      authorName: data.author_name as string | undefined,
    });
  } catch {
    // Video may be private/unlisted-restricted/deleted — still let the user save it manually.
    return NextResponse.json({
      youtubeId,
      title: null,
      thumbnailUrl: youtubeThumbnail(youtubeId),
      authorName: null,
    });
  }
}
