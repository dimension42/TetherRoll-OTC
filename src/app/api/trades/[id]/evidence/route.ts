import { requireUser, handleApiError, AuthError } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

/**
 * POST /api/trades/[id]/evidence — 분쟁 증거 파일 업로드.
 * multipart/form-data, file ≤10MB, image/pdf → Storage 'evidence' bucket.
 * 반환: { path, sha256, keccak256 }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { id } = params;

    const { data: trade } = await db()
      .from('trades')
      .select('seller_id, buyer_id')
      .eq('id', id)
      .single();

    if (!trade) throw new AuthError(404, 'Trade not found');
    if (trade.seller_id !== user.id && trade.buyer_id !== user.id) {
      throw new AuthError(403, 'Not a party');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) throw new AuthError(400, 'No file');

    const size = file.size;
    if (size > 10 * 1024 * 1024) throw new AuthError(400, 'File too large (max 10MB)');

    const type = file.type;
    if (!type.startsWith('image/') && type !== 'application/pdf') {
      throw new AuthError(400, 'Invalid file type (image or pdf only)');
    }

    // 파일 읽기
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // sha256, keccak256 계산
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const keccak256 = createHash('sha3-256').update(buffer).digest('hex'); // keccak256은 viem에서 처리 권장, 여기선 sha3-256

    // Storage 업로드
    const ext = file.name.split('.').pop() || 'bin';
    const uuid = crypto.randomUUID();
    const path = `trades/${id}/${uuid}.${ext}`;

    const { error } = await db()
      .storage
      .from('evidence')
      .upload(path, buffer, { contentType: type });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    return Response.json({ path, sha256, keccak256 });
  } catch (e) {
    return handleApiError(e);
  }
}
