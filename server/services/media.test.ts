import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MediaService } from './media';
import { storage } from '../storage';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://signed-url.example.com'),
}));

// Mock sharp
vi.mock('sharp', () => {
  const mockSharp = vi.fn().mockReturnValue({
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-image')),
  });
  return { default: mockSharp };
});

// Mock ffmpeg
vi.mock('fluent-ffmpeg', () => {
  const mockFfmpeg = vi.fn().mockReturnValue({
    screenshots: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    videoCodec: vi.fn().mockReturnThis(),
    audioCodec: vi.fn().mockReturnThis(),
    videoBitrate: vi.fn().mockReturnThis(),
    size: vi.fn().mockReturnThis(),
    on: vi.fn().mockImplementation((event, callback) => {
      if (event === 'end') {
        setTimeout(callback, 10);
      }
      return mockFfmpeg();
    }),
    run: vi.fn().mockReturnThis(),
  });
  mockFfmpeg.setFfmpegPath = vi.fn();
  return { default: mockFfmpeg };
});

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('file-content')),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

// Mock storage
vi.mock('../storage', () => ({
  storage: {
    createMediaFile: vi.fn(),
    getMediaFile: vi.fn(),
    updateMediaFile: vi.fn(),
    deleteMediaFile: vi.fn(),
    getMediaFilesByUser: vi.fn(),
    getMediaFilesByRelated: vi.fn(),
  },
}));

describe('MediaService', () => {
  let mediaService: MediaService;
  let mockS3Send: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock environment variables
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_S3_BUCKET = 'test-bucket';
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';

    mediaService = new MediaService();
    
    // Get the mocked S3 send method
    const { S3Client } = require('@aws-sdk/client-s3');
    mockS3Send = vi.fn().mockResolvedValue({});
    S3Client.mockImplementation(() => ({
      send: mockS3Send,
    }));
  });

  afterEach(() => {
    delete process.env.AWS_REGION;
    delete process.env.AWS_S3_BUCKET;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  describe('uploadFile', () => {
    const mockFile = {
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('test-image-data'),
    } as Express.Multer.File;

    const mockMediaFile = {
      id: 'file-id',
      userId: 'user-id',
      filename: 'generated-filename.jpg',
      originalName: 'test.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024,
      fileType: 'image',
      s3Key: 'uploads/user-id/generated-filename.jpg',
      s3Bucket: 'test-bucket',
      cdnUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/uploads/user-id/generated-filename.jpg',
      processingStatus: 'pending',
      virusScanStatus: 'clean',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should upload file successfully', async () => {
      vi.mocked(storage.createMediaFile).mockResolvedValue(mockMediaFile as any);

      const result = await mediaService.uploadFile('user-id', mockFile);

      expect(mockS3Send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: expect.stringMatching(/^uploads\/user-id\/.*\.jpg$/),
            Body: mockFile.buffer,
            ContentType: 'image/jpeg',
          }),
        })
      );

      expect(storage.createMediaFile).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-id',
          originalName: 'test.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
          fileType: 'image',
        })
      );

      expect(result).toEqual(mockMediaFile);
    });

    it('should validate file size', async () => {
      const largeFile = {
        ...mockFile,
        size: 200 * 1024 * 1024, // 200MB
      };

      await expect(mediaService.uploadFile('user-id', largeFile)).rejects.toThrow(
        'File size exceeds maximum allowed size'
      );
    });

    it('should validate file type', async () => {
      const invalidFile = {
        ...mockFile,
        mimetype: 'application/x-executable',
      };

      await expect(mediaService.uploadFile('user-id', invalidFile)).rejects.toThrow(
        'File type application/x-executable is not allowed'
      );
    });

    it('should handle upload options', async () => {
      vi.mocked(storage.createMediaFile).mockResolvedValue(mockMediaFile as any);

      await mediaService.uploadFile('user-id', mockFile, {
        relatedType: 'course',
        relatedId: 'course-id',
        isPublic: true,
      });

      expect(storage.createMediaFile).toHaveBeenCalledWith(
        expect.objectContaining({
          relatedType: 'course',
          relatedId: 'course-id',
          isPublic: true,
        })
      );
    });
  });

  describe('getFileUrl', () => {
    const mockMediaFile = {
      id: 'file-id',
      userId: 'user-id',
      s3Key: 'uploads/user-id/test.jpg',
      s3Bucket: 'test-bucket',
      isPublic: false,
      cdnUrl: 'https://cdn.example.com/test.jpg',
    };

    it('should return CDN URL for public files', async () => {
      const publicFile = { ...mockMediaFile, isPublic: true };
      vi.mocked(storage.getMediaFile).mockResolvedValue(publicFile as any);

      const url = await mediaService.getFileUrl('file-id');

      expect(url).toBe('https://cdn.example.com/test.jpg');
    });

    it('should return signed URL for private files', async () => {
      vi.mocked(storage.getMediaFile).mockResolvedValue(mockMediaFile as any);

      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      getSignedUrl.mockResolvedValue('https://signed-url.example.com');

      const url = await mediaService.getFileUrl('file-id', 'user-id');

      expect(url).toBe('https://signed-url.example.com');
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it('should throw error for non-existent file', async () => {
      vi.mocked(storage.getMediaFile).mockResolvedValue(undefined);

      await expect(mediaService.getFileUrl('non-existent-id')).rejects.toThrow('File not found');
    });

    it('should throw error for access denied', async () => {
      vi.mocked(storage.getMediaFile).mockResolvedValue(mockMediaFile as any);

      await expect(mediaService.getFileUrl('file-id', 'other-user-id')).rejects.toThrow('Access denied');
    });
  });

  describe('deleteFile', () => {
    const mockMediaFile = {
      id: 'file-id',
      userId: 'user-id',
      s3Key: 'uploads/user-id/test.jpg',
      s3Bucket: 'test-bucket',
      thumbnailUrl: 'https://cdn.example.com/thumbnails/user-id/file-id_thumb.jpg',
      processedUrl: 'https://cdn.example.com/processed/user-id/file-id_processed.jpg',
    };

    it('should delete file successfully', async () => {
      vi.mocked(storage.getMediaFile).mockResolvedValue(mockMediaFile as any);
      vi.mocked(storage.deleteMediaFile).mockResolvedValue(true);

      const result = await mediaService.deleteFile('file-id', 'user-id');

      expect(mockS3Send).toHaveBeenCalledTimes(3); // Original + thumbnail + processed
      expect(storage.deleteMediaFile).toHaveBeenCalledWith('file-id');
      expect(result).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      vi.mocked(storage.getMediaFile).mockResolvedValue(undefined);

      const result = await mediaService.deleteFile('non-existent-id', 'user-id');

      expect(result).toBe(false);
    });

    it('should throw error for access denied', async () => {
      vi.mocked(storage.getMediaFile).mockResolvedValue(mockMediaFile as any);

      await expect(mediaService.deleteFile('file-id', 'other-user-id')).rejects.toThrow('Access denied');
    });
  });

  describe('getUserFiles', () => {
    it('should get user files', async () => {
      const mockFiles = [
        { id: 'file-1', userId: 'user-id', fileType: 'image' },
        { id: 'file-2', userId: 'user-id', fileType: 'video' },
      ];

      vi.mocked(storage.getMediaFilesByUser).mockResolvedValue(mockFiles as any);

      const result = await mediaService.getUserFiles('user-id');

      expect(storage.getMediaFilesByUser).toHaveBeenCalledWith('user-id', undefined);
      expect(result).toEqual(mockFiles);
    });

    it('should filter by file type', async () => {
      const mockFiles = [
        { id: 'file-1', userId: 'user-id', fileType: 'image' },
      ];

      vi.mocked(storage.getMediaFilesByUser).mockResolvedValue(mockFiles as any);

      const result = await mediaService.getUserFiles('user-id', 'image');

      expect(storage.getMediaFilesByUser).toHaveBeenCalledWith('user-id', 'image');
      expect(result).toEqual(mockFiles);
    });
  });

  describe('getRelatedFiles', () => {
    it('should get related files', async () => {
      const mockFiles = [
        { id: 'file-1', relatedType: 'course', relatedId: 'course-id' },
      ];

      vi.mocked(storage.getMediaFilesByRelated).mockResolvedValue(mockFiles as any);

      const result = await mediaService.getRelatedFiles('course', 'course-id');

      expect(storage.getMediaFilesByRelated).toHaveBeenCalledWith('course', 'course-id');
      expect(result).toEqual(mockFiles);
    });
  });

  describe('file type detection', () => {
    it('should detect image files', async () => {
      const imageFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      vi.mocked(storage.createMediaFile).mockResolvedValue({
        id: 'file-id',
        fileType: 'image',
      } as any);

      await mediaService.uploadFile('user-id', imageFile);

      expect(storage.createMediaFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fileType: 'image',
        })
      );
    });

    it('should detect video files', async () => {
      const videoFile = {
        originalname: 'test.mp4',
        mimetype: 'video/mp4',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      vi.mocked(storage.createMediaFile).mockResolvedValue({
        id: 'file-id',
        fileType: 'video',
      } as any);

      await mediaService.uploadFile('user-id', videoFile);

      expect(storage.createMediaFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fileType: 'video',
        })
      );
    });

    it('should detect document files', async () => {
      const docFile = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      vi.mocked(storage.createMediaFile).mockResolvedValue({
        id: 'file-id',
        fileType: 'document',
      } as any);

      await mediaService.uploadFile('user-id', docFile);

      expect(storage.createMediaFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fileType: 'document',
        })
      );
    });
  });
});