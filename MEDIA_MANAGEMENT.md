# Media Management System

This document describes the media management system implemented for the SkillSwap platform.

## Overview

The media management system provides secure file upload, storage, and retrieval capabilities for the SkillSwap platform. It supports images, videos, audio files, and documents with automatic processing, virus scanning, and CDN integration.

## Features

### File Upload
- **Single and multiple file uploads**
- **File type validation** (images, videos, audio, documents)
- **File size limits** (100MB max per file)
- **Virus scanning** (configurable)
- **Automatic file processing** (thumbnails, transcoding)

### Storage
- **AWS S3 integration** for scalable file storage
- **CDN support** for fast content delivery
- **Secure file access** with signed URLs
- **Public/private file access control**

### File Processing
- **Image processing**: Automatic resizing and thumbnail generation
- **Video processing**: Thumbnail extraction and transcoding
- **Metadata extraction** and storage

### API Endpoints

#### Upload Files
```
POST /api/media/upload
POST /api/media/upload-multiple
```

#### Access Files
```
GET /api/media/:id
GET /api/media/:id/info
```

#### Manage Files
```
DELETE /api/media/:id
GET /api/media/user/files
GET /api/media/related/:type/:id
```

## Configuration

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_S3_BUCKET=skillswap-media
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
CDN_DOMAIN=cdn.skillswap.com (optional)
```

### File Type Support

**Images**: JPEG, PNG, GIF, WebP
**Videos**: MP4, WebM, QuickTime
**Audio**: MP3, WAV, OGG
**Documents**: PDF, TXT, DOC, DOCX

## Usage Examples

### Upload a Course Material
```javascript
const formData = new FormData();
formData.append('file', file);

const response = await fetch('/api/media/upload?relatedType=course&relatedId=course-123', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### Get File URL
```javascript
const response = await fetch('/api/media/file-id-123', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { url } = await response.json();
```

### Get User's Files
```javascript
const response = await fetch('/api/media/user/files?fileType=image&page=1&limit=20', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { files, pagination } = await response.json();
```

## Database Schema

### media_files Table
- `id`: Unique file identifier
- `user_id`: Owner of the file
- `filename`: Generated filename
- `original_name`: Original filename
- `mime_type`: File MIME type
- `file_size`: File size in bytes
- `file_type`: Category (image, video, audio, document)
- `s3_key`: S3 object key
- `s3_bucket`: S3 bucket name
- `cdn_url`: CDN URL for public access
- `thumbnail_url`: Thumbnail URL (for images/videos)
- `processed_url`: Processed file URL
- `processing_status`: Processing status
- `related_type`: Related entity type (course, lesson, etc.)
- `related_id`: Related entity ID
- `is_public`: Public access flag
- `virus_scan_status`: Virus scan status
- `created_at`: Upload timestamp
- `updated_at`: Last update timestamp

## Security Considerations

### Access Control
- **Authentication required** for all upload operations
- **Owner-based access control** for private files
- **Public files** accessible without authentication
- **Signed URLs** for temporary access to private files

### File Validation
- **MIME type validation** to prevent malicious uploads
- **File size limits** to prevent abuse
- **Virus scanning** (when enabled)
- **Content sanitization** for uploaded files

### Storage Security
- **Encrypted storage** in AWS S3
- **Secure file keys** with UUID-based naming
- **Access logging** for audit trails
- **CDN security** with proper headers

## Performance Optimization

### Caching
- **CDN caching** for public files
- **Browser caching** with appropriate headers
- **Thumbnail caching** for quick preview loading

### Processing
- **Asynchronous processing** for large files
- **Background job processing** for video transcoding
- **Progressive image loading** with thumbnails

### Storage
- **S3 lifecycle policies** for cost optimization
- **Compression** for images and videos
- **Efficient file organization** with folder structure

## Monitoring and Maintenance

### Metrics
- Upload success/failure rates
- File processing times
- Storage usage and costs
- CDN hit rates

### Cleanup
- Automatic cleanup of orphaned files
- Periodic virus scan updates
- Storage optimization and archiving

## Future Enhancements

- **Image recognition** and auto-tagging
- **Advanced video processing** (multiple quality levels)
- **Real-time collaboration** on documents
- **Advanced search** and filtering capabilities
- **Integration with external storage providers**