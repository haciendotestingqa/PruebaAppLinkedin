'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, FileText, CheckCircle2 } from 'lucide-react'

interface CVUploadFormProps {
  onUploadSuccess?: () => void
}

export function CVUploadForm({ onUploadSuccess }: CVUploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB')
        return
      }
      setFile(selectedFile)
      setError(null)
      setUploaded(false)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload-cv', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload CV')
      }

      const data = await response.json()
      console.log('CV parsed successfully:', data)
      
      // Guardar el perfil en localStorage del cliente
      if (data.profile) {
        localStorage.setItem('qa_profile', JSON.stringify(data.profile))
        console.log('✅ Profile saved to localStorage')
      }
      
      setUploaded(true)
      
      // Notificar éxito
      alert('✅ CV cargado exitosamente!')
      
      // Llamar al callback si existe
      if (onUploadSuccess) {
        onUploadSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Your CV</CardTitle>
        <CardDescription>
          Upload your CV (PDF or DOCX) to automatically extract your QA skills and experience
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileChange}
              disabled={uploading || uploaded}
            />
            {error && (
              <p className="text-sm text-destructive mt-2">{error}</p>
            )}
            {uploaded && (
              <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                CV uploaded and parsed successfully!
              </p>
            )}
          </div>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading || uploaded}
          >
            {uploading ? (
              'Uploading...'
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </div>
        
        {file && (
          <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{file.name}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {(file.size / 1024).toFixed(2)} KB
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

