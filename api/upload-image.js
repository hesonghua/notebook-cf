import { authenticateToken } from './_utils/_auth.js';
import { withErrorHandling } from './_utils/db-handler.js';

async function uploadImageHandler(request, env) {
  // 只允许 POST 请求
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, message: 'Method Not Allowed' },
      { status: 405 }
    );
  }

  try {
    // 验证用户身份
    const { userId } = await authenticateToken(request, env.JWT_SECRET);

    // 获取上传的文件
    const formData = await request.formData();
    const file = formData.get('image');

    if (!file) {
      return Response.json(
        { success: false, message: 'No image file provided' },
        { status: 400 }
      );
    }

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        { success: false, message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // 验证文件大小 (最大 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return Response.json(
        { success: false, message: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/${timestamp}-${randomStr}.${extension}`;

    // 上传到 R2
    await env.IMAGES.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // 生成公开访问 URL
    // 从环境变量获取 R2 公开 URL
    const r2PublicUrl = env.R2_PUBLIC_URL || 'https://pub-xxxxx.r2.dev';
    const imageUrl = `${r2PublicUrl}/${fileName}`;

    return Response.json({
      success: true,
      url: imageUrl,
      fileName: fileName,
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    if (error.status === 401 || error.status === 403) {
      return Response.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    return Response.json(
      { success: false, message: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

export default withErrorHandling(uploadImageHandler);