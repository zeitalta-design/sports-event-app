import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createPhoto } from "@/lib/photo-service";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * Phase200: 写真アップロードAPI
 *
 * POST /api/photos/upload
 * FormData: { photo: File, event_id, sport_type, image_type, caption }
 */

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const formData = await request.formData();
    const photo = formData.get("photo");
    const eventId = parseInt(formData.get("event_id"));
    const sportType = formData.get("sport_type") || "marathon";
    const imageType = formData.get("image_type") || "other";
    const caption = formData.get("caption") || "";

    if (!photo || !eventId) {
      return NextResponse.json({ error: "photo, event_id は必須です" }, { status: 400 });
    }

    // ファイルサイズチェック (5MB)
    if (photo.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "ファイルサイズは5MB以下にしてください" }, { status: 400 });
    }

    // ファイル保存
    const ext = photo.name?.split(".").pop() || "jpg";
    const filename = `${eventId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "photos");
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);

    const buffer = Buffer.from(await photo.arrayBuffer());
    await writeFile(filePath, buffer);

    const imageUrl = `/uploads/photos/${filename}`;

    // DB保存
    const photoId = createPhoto({
      event_id: eventId,
      sport_type: sportType,
      image_url: imageUrl,
      image_type: imageType,
      caption: caption,
      alt_text: caption || `${imageType}の写真`,
      source_type: "user",
      uploaded_by: user.id,
      status: "pending", // 確認後に公開
      taken_year: new Date().getFullYear(),
    });

    return NextResponse.json({
      success: true,
      message: "写真をアップロードしました（確認後に公開されます）",
      photo_id: photoId,
    });
  } catch (err) {
    console.error("Photo upload error:", err);
    return NextResponse.json({ error: "アップロードに失敗しました" }, { status: 500 });
  }
}
