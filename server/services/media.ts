import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { storage } from '../storage';
import type { MediaFile, InsertMediaFile } from '@shared/schema';

// Set ffmpeg path
if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
}

interface MediaConfig {
    s3: {
        region: string;
        bucket: string;
        accessKeyId: string;
        secretAccessKey: string;
        cdnDomain?: string;
    };
    upload: {
        maxFileSize: number; // in bytes
        allowedMimeTypes: string[];
        virusScanEnabled: boolean;
    };
    processing: {
        imageMaxWidth: number;
        imageMaxHeight: number;
        videoMaxBitrate: string;
        thumbnailSize: { width: number; height: number };
    };
}

const defaultConfig: MediaConfig = {
    s3: {
        region: process.env.AWS_REGION || 'us-east-1',
        bucket: process.env.AWS_S3_BUCKET || 'skillswap-media',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        cdnDomain: process.env.CDN_DOMAIN,
    },
    upload: {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/webm',
            'video/quicktime',
            'audio/mpeg',
            'audio/wav',
            'audio/ogg',
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        virusScanEnabled: false, // Would integrate with ClamAV or similar in production
    },
    processing: {
        imageMaxWidth: 1920,
        imageMaxHeight: 1080,
        videoMaxBitrate: '2000k',
        thumbnailSize: { width: 300, height: 200 },
    },
};

export class MediaService {
    private s3Client: S3Client;
    private config: MediaConfig;

    constructor(config: Partial<MediaConfig> = {}) {
        this.config = { ...defaultConfig, ...config };

        this.s3Client = new S3Client({
            region: this.config.s3.region,
            credentials: {
                accessKeyId: this.config.s3.accessKeyId,
                secretAccessKey: this.config.s3.secretAccessKey,
            },
        });
    }

    /**
     * Upload a file to S3 and create database record
     */
    async uploadFile(
        userId: string,
        file: Express.Multer.File,
        options: {
            relatedType?: string;
            relatedId?: string;
            isPublic?: boolean;
        } = {}
    ): Promise<MediaFile> {
        // Validate file
        this.validateFile(file);

        // Generate unique filename and S3 key
        const fileExtension = path.extname(file.originalname);
        const filename = `${randomUUID()}${fileExtension}`;
        const s3Key = `uploads/${userId}/${filename}`;

        // Determine file type
        const fileType = this.getFileType(file.mimetype);

        // Upload to S3
        const uploadCommand = new PutObjectCommand({
            Bucket: this.config.s3.bucket,
            Key: s3Key,
            Body: file.buffer,
            ContentType: file.mimetype,
            Metadata: {
                originalName: file.originalname,
                userId,
                uploadedAt: new Date().toISOString(),
            },
        });

        await this.s3Client.send(uploadCommand);

        // Generate CDN URL
        const cdnUrl = this.generateCdnUrl(s3Key);

        // Create database record
        const mediaFileData: InsertMediaFile = {
            userId,
            filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            fileType,
            s3Key,
            s3Bucket: this.config.s3.bucket,
            cdnUrl,
            relatedType: options.relatedType,
            relatedId: options.relatedId,
            isPublic: options.isPublic || false,
            virusScanResult: 'clean', // Simplified for now
        };

        const mediaFile = await storage.createMediaFile(mediaFileData);

        // Process file asynchronously
        this.processFileAsync(mediaFile.id, file.buffer, fileType);

        return mediaFile;
    }

    /**
     * Get a secure URL for accessing a file
     */
    async getFileUrl(fileId: string, userId?: string, expiresIn: number = 3600): Promise<string> {
        const mediaFile = await storage.getMediaFile(fileId);
        if (!mediaFile) {
            throw new Error('File not found');
        }

        // Check access permissions
        if (!mediaFile.isPublic && mediaFile.userId !== userId) {
            throw new Error('Access denied');
        }

        // If file is public and has CDN URL, return it directly
        if (mediaFile.isPublic && mediaFile.cdnUrl) {
            return mediaFile.cdnUrl;
        }

        // Generate signed URL for private files
        const command = new GetObjectCommand({
            Bucket: mediaFile.s3Bucket,
            Key: mediaFile.s3Key,
        });

        return await getSignedUrl(this.s3Client, command, { expiresIn });
    }

    /**
     * Delete a file
     */
    async deleteFile(fileId: string, userId: string): Promise<boolean> {
        const mediaFile = await storage.getMediaFile(fileId);
        if (!mediaFile) {
            return false;
        }

        // Check permissions
        if (mediaFile.userId !== userId) {
            throw new Error('Access denied');
        }

        // Delete from S3
        const deleteCommand = new DeleteObjectCommand({
            Bucket: mediaFile.s3Bucket,
            Key: mediaFile.s3Key,
        });

        await this.s3Client.send(deleteCommand);

        // Delete thumbnail and processed files if they exist
        if (mediaFile.thumbnailUrl) {
            const thumbnailKey = this.extractS3KeyFromUrl(mediaFile.thumbnailUrl);
            if (thumbnailKey) {
                await this.s3Client.send(new DeleteObjectCommand({
                    Bucket: mediaFile.s3Bucket,
                    Key: thumbnailKey,
                }));
            }
        }

        if (mediaFile.processedUrl) {
            const processedKey = this.extractS3KeyFromUrl(mediaFile.processedUrl);
            if (processedKey) {
                await this.s3Client.send(new DeleteObjectCommand({
                    Bucket: mediaFile.s3Bucket,
                    Key: processedKey,
                }));
            }
        }

        // Delete from database
        return await storage.deleteMediaFile(fileId);
    }

    /**
     * Get files by user
     */
    async getUserFiles(userId: string, fileType?: string): Promise<MediaFile[]> {
        return await storage.getMediaFilesByUser(userId, fileType);
    }

    /**
     * Get files by related entity
     */
    async getRelatedFiles(relatedType: string, relatedId: string): Promise<MediaFile[]> {
        return await storage.getMediaFilesByRelated(relatedType, relatedId);
    }

    /**
     * Process file asynchronously (thumbnails, transcoding, etc.)
     */
    private async processFileAsync(fileId: string, fileBuffer: Buffer, fileType: string): Promise<void> {
        try {
            await storage.updateMediaFile(fileId, { processingStatus: 'processing' });

            let thumbnailUrl: string | undefined;
            let processedUrl: string | undefined;

            if (fileType === 'image') {
                const results = await this.processImage(fileId, fileBuffer);
                thumbnailUrl = results.thumbnailUrl;
                processedUrl = results.processedUrl;
            } else if (fileType === 'video') {
                const results = await this.processVideo(fileId, fileBuffer);
                thumbnailUrl = results.thumbnailUrl;
                processedUrl = results.processedUrl;
            }

            await storage.updateMediaFile(fileId, {
                processingStatus: 'completed',
                thumbnailUrl,
                processedUrl,
            });
        } catch (error) {
            console.error('File processing failed:', error);
            await storage.updateMediaFile(fileId, { processingStatus: 'failed' });
        }
    }

    /**
     * Process image (resize, create thumbnail)
     */
    private async processImage(fileId: string, imageBuffer: Buffer): Promise<{
        thumbnailUrl: string;
        processedUrl: string;
    }> {
        const mediaFile = await storage.getMediaFile(fileId);
        if (!mediaFile) throw new Error('Media file not found');

        // Create thumbnail
        const thumbnailBuffer = await sharp(imageBuffer)
            .resize(this.config.processing.thumbnailSize.width, this.config.processing.thumbnailSize.height, {
                fit: 'cover',
                position: 'center',
            })
            .jpeg({ quality: 80 })
            .toBuffer();

        const thumbnailKey = `thumbnails/${mediaFile.userId}/${fileId}_thumb.jpg`;
        await this.uploadToS3(thumbnailKey, thumbnailBuffer, 'image/jpeg');
        const thumbnailUrl = this.generateCdnUrl(thumbnailKey);

        // Create processed version (resized if too large)
        const processedBuffer = await sharp(imageBuffer)
            .resize(this.config.processing.imageMaxWidth, this.config.processing.imageMaxHeight, {
                fit: 'inside',
                withoutEnlargement: true,
            })
            .jpeg({ quality: 85 })
            .toBuffer();

        const processedKey = `processed/${mediaFile.userId}/${fileId}_processed.jpg`;
        await this.uploadToS3(processedKey, processedBuffer, 'image/jpeg');
        const processedUrl = this.generateCdnUrl(processedKey);

        return { thumbnailUrl, processedUrl };
    }

    /**
     * Process video (create thumbnail, transcode if needed)
     */
    private async processVideo(fileId: string, videoBuffer: Buffer): Promise<{
        thumbnailUrl: string;
        processedUrl: string;
    }> {
        const mediaFile = await storage.getMediaFile(fileId);
        if (!mediaFile) throw new Error('Media file not found');

        // Create temporary file for ffmpeg processing
        const tempInputPath = `/tmp/${fileId}_input`;
        const tempThumbnailPath = `/tmp/${fileId}_thumb.jpg`;
        const tempProcessedPath = `/tmp/${fileId}_processed.mp4`;

        await fs.writeFile(tempInputPath, videoBuffer);

        try {
            // Generate thumbnail from video
            await new Promise<void>((resolve, reject) => {
                ffmpeg(tempInputPath)
                    .screenshots({
                        count: 1,
                        folder: '/tmp',
                        filename: `${fileId}_thumb.jpg`,
                        size: `${this.config.processing.thumbnailSize.width}x${this.config.processing.thumbnailSize.height}`,
                    })
                    .on('end', () => resolve())
                    .on('error', reject);
            });

            const thumbnailBuffer = await fs.readFile(tempThumbnailPath);
            const thumbnailKey = `thumbnails/${mediaFile.userId}/${fileId}_thumb.jpg`;
            await this.uploadToS3(thumbnailKey, thumbnailBuffer, 'image/jpeg');
            const thumbnailUrl = this.generateCdnUrl(thumbnailKey);

            // Transcode video if needed
            await new Promise<void>((resolve, reject) => {
                ffmpeg(tempInputPath)
                    .output(tempProcessedPath)
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .videoBitrate(this.config.processing.videoMaxBitrate)
                    .size('1280x720')
                    .on('end', () => resolve())
                    .on('error', reject)
                    .run();
            });

            const processedBuffer = await fs.readFile(tempProcessedPath);
            const processedKey = `processed/${mediaFile.userId}/${fileId}_processed.mp4`;
            await this.uploadToS3(processedKey, processedBuffer, 'video/mp4');
            const processedUrl = this.generateCdnUrl(processedKey);

            return { thumbnailUrl, processedUrl };
        } finally {
            // Clean up temporary files
            await Promise.allSettled([
                fs.unlink(tempInputPath),
                fs.unlink(tempThumbnailPath),
                fs.unlink(tempProcessedPath),
            ]);
        }
    }

    /**
     * Upload buffer to S3
     */
    private async uploadToS3(key: string, buffer: Buffer, contentType: string): Promise<void> {
        const command = new PutObjectCommand({
            Bucket: this.config.s3.bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        });

        await this.s3Client.send(command);
    }

    /**
     * Validate uploaded file
     */
    private validateFile(file: Express.Multer.File): void {
        if (file.size > this.config.upload.maxFileSize) {
            throw new Error(`File size exceeds maximum allowed size of ${this.config.upload.maxFileSize} bytes`);
        }

        if (!this.config.upload.allowedMimeTypes.includes(file.mimetype)) {
            throw new Error(`File type ${file.mimetype} is not allowed`);
        }
    }

    /**
     * Determine file type from MIME type
     */
    private getFileType(mimeType: string): string {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        return 'document';
    }

    /**
     * Generate CDN URL
     */
    private generateCdnUrl(s3Key: string): string {
        if (this.config.s3.cdnDomain) {
            return `https://${this.config.s3.cdnDomain}/${s3Key}`;
        }
        return `https://${this.config.s3.bucket}.s3.${this.config.s3.region}.amazonaws.com/${s3Key}`;
    }

    /**
     * Extract S3 key from URL
     */
    private extractS3KeyFromUrl(url: string): string | null {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname.substring(1); // Remove leading slash
        } catch {
            return null;
        }
    }
}

export const mediaService = new MediaService();