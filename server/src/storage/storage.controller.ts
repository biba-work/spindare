import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { StorageService } from './storage.service';

@Controller('storage')
@UseGuards(ClerkAuthGuard)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('upload')
  async upload(
    @Body() body: { base64: string; contentType: string; folder?: string },
  ) {
    const url = await this.storage.uploadBase64(
      body.base64,
      body.contentType,
      body.folder,
    );
    return { url };
  }

  // For video: client requests a presigned URL, then PUTs the file bytes
  // directly to it — never through this server.
  @Post('presign')
  async presign(
    @Body() body: { filename: string; contentType: string; folder?: string },
  ) {
    return this.storage.getUploadUrl(body.filename, body.contentType, body.folder);
  }
}
