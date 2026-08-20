import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const patchSchema = z.object({
  groupJid: z.string().min(5).optional(),
  groupLabel: z.string().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.canManageProjects) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { groupJid, groupLabel, enabled } = parsed.data;
  const { id } = await params;

  const existing = await sql`SELECT id FROM whatsapp_report_groups WHERE project_id = ${id} LIMIT 1`;

  if (existing[0]) {
    if (groupJid !== undefined) {
      await sql`UPDATE whatsapp_report_groups SET group_jid = ${groupJid} WHERE project_id = ${id}`;
    }
    if (groupLabel !== undefined) {
      await sql`UPDATE whatsapp_report_groups SET group_label = ${groupLabel} WHERE project_id = ${id}`;
    }
    if (enabled !== undefined) {
      await sql`UPDATE whatsapp_report_groups SET enabled = ${enabled} WHERE project_id = ${id}`;
    }
  } else {
    if (!groupJid) {
      return NextResponse.json(
        { error: "Сначала укажите JID группы (см. npm run list-groups в whatsapp-report-bot)" },
        { status: 400 }
      );
    }
    await sql`
      INSERT INTO whatsapp_report_groups (project_id, group_jid, group_label, enabled)
      VALUES (${id}, ${groupJid}, ${groupLabel ?? null}, ${enabled ?? true})
    `;
  }

  const rows = await sql`
    SELECT id, group_jid, group_label, enabled FROM whatsapp_report_groups WHERE project_id = ${id} LIMIT 1
  `;
  return NextResponse.json({ whatsappReportGroup: rows[0] });
}
