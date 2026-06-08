import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Image as ImageIcon, Trash2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGalleryImages, useUploadImage, useDeleteImage, getImageUrl, useProperty } from '@/hooks/useSupabase';

export default function Gallery() {
  const { data: property } = useProperty();
  const { data: images = [], isLoading } = useGalleryImages(property?.id);
  const { mutateAsync: uploadImage, isPending: isUploading } = useUploadImage();
  const { mutateAsync: deleteImage } = useDeleteImage();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (path: string) => {
    if (!property?.id) return;
    if (window.confirm("Are you sure you want to delete this image?")) {
      setDeletingId(path);
      try {
        await deleteImage({ path, propertyId: property.id });
      } catch (err) {
        console.error("Failed to delete image:", err);
        alert(`Failed to delete image.`);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!property?.id) return;
    for (const file of acceptedFiles) {
      try {
        await uploadImage({ file, propertyId: property.id });
      } catch (err) {
        console.error("Failed to upload image:", err);
        alert(`Failed to upload ${file.name}`);
      }
    }
  }, [uploadImage, property?.id]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif']
    }
  });

  const handleCopyUrl = (path: string) => {
    const url = getImageUrl(path);
    navigator.clipboard.writeText(url);
    setCopiedId(path);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-8 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Photo Gallery</h1>
          <p className="text-muted-foreground mt-1">Upload and manage images for your property and rooms.</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Uploader */}
        <Card>
          <CardContent className="p-6">
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'}
                ${isUploading ? 'opacity-50 pointer-events-none' : ''}
              `}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                  <UploadCloud className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-medium">
                    {isUploading ? 'Uploading...' : 'Click or drag images to upload'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Supports JPG, PNG, WEBP, GIF up to 5MB
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gallery Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Uploaded Images</h2>
          
          {isLoading ? (
            <div className="text-muted-foreground">Loading images...</div>
          ) : images.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-xl border">
              <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="text-muted-foreground">No images uploaded yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((file: any) => {
                const url = getImageUrl(file.name);
                const isCopied = copiedId === file.name;
                
                return (
                  <div key={file.id} className="group relative aspect-square rounded-xl border bg-muted overflow-hidden">
                    <img 
                      src={url} 
                      alt={file.name} 
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className={`absolute inset-0 bg-black/50 transition-opacity flex flex-col justify-between p-3 ${deletingId === file.name ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <div className="flex justify-between items-start">
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8 bg-destructive/80 hover:bg-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(file.name);
                          }}
                          disabled={deletingId === file.name}
                          title="Delete Image"
                        >
                          <Trash2 className={`w-4 h-4 ${deletingId === file.name ? 'animate-pulse' : ''}`} />
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="h-8 w-8 bg-background/80 hover:bg-background"
                          onClick={() => handleCopyUrl(file.name)}
                          title="Copy URL"
                        >
                          {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <div className="text-xs text-white truncate px-1 drop-shadow-md">
                        {file.name}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
