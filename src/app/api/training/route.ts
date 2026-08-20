import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { extractYoutubeId, youtubeThumbnail } from "@/lib/youtube";

const postSchema = z.object({
  title: z.string().min(1),
  youtubeUrl: z.string().url(),
  description: z.string().optional(),
  category: z.string().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const videos = await sql`
    SELECT tv.id, tv.title, tv.youtube_url, tv.youtube_id, tv.thumbnail_url, tv.description, tv.category,
           tv.created_at, u.name AS added_by_name
    FROM training_videos tv
    LEFT JOIN users u ON u.id = tv.added_by
    ORDER BY tv.created_at DESC
  `;

  return NextResponse.json({ videos });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.canManageProjects) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { title, youtubeUrl, description, category } = parsed.data;

  const youtubeId = extractYoutubeId(youtubeUrl);
  if (!youtubeId) {
    return NextResponse.json({ error: "Не удалось распознать ссылку YouTube" }, { status: 400 });
  }

  const rows = await sql`
    INSERT INTO training_videos (title, youtube_url, youtube_id, thumbnail_url, description, category, added_by)
    VALUES (${title}, ${youtubeUrl}, ${youtubeId}, ${youtubeThumbnail(youtubeId)}, ${description ?? null}, ${category ?? null}, ${user.id})
    RETURNING id, title, youtube_url, youtube_id, thumbnail_url, description, category, created_at
  `;

  return NextResponse.json({ video: rows[0] });
}
