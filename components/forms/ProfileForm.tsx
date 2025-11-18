'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { QAProfile, Skill } from '@/types'
import { Save, CheckCircle2, Settings } from 'lucide-react'

interface ProfileFormProps {
  profile: QAProfile | null
  onSave: (profile: QAProfile) => void
}

export function ProfileForm({ profile, onSave }: ProfileFormProps) {
  const [formData, setFormData] = useState<Partial<QAProfile>>({
    name: '',
    email: '',
    totalExperience: 0,
    availability: 'immediate',
    location: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setFormData(profile)
    }
  }, [profile])

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const profileToSave = {
        ...profile,
        ...formData,
        updatedAt: new Date(),
      } as QAProfile

      onSave(profileToSave)
    } finally {
      setSaving(false)
    }
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Please upload your CV first to create your profile
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>QA Profile</CardTitle>
        <CardDescription>
          Manage your profile information and preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="experience">Years of Experience</Label>
              <Input
                id="experience"
                type="number"
                value={formData.totalExperience}
                onChange={(e) => handleChange('totalExperience', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="availability">Availability</Label>
              <select
                id="availability"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
                value={formData.availability}
                onChange={(e) => handleChange('availability', e.target.value)}
              >
                <option value="immediate">Immediate</option>
                <option value="2 weeks">2 weeks</option>
                <option value="1 month">1 month</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
            />
          </div>

          {/* Skills Section */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <Label>Detected Skills from CV</Label>
              <Badge variant="secondary">{profile.skills?.length || 0} skills</Badge>
            </div>
            
            {profile.skills && profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-3 bg-secondary rounded-lg border">
                {profile.skills.map((skill, idx) => (
                  <Badge key={idx} variant="default" className="text-xs">
                    {skill.name}
                    {skill.years && ` (${skill.years}y)`}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                No skills detected. Make sure your CV mentions specific tools and technologies.
              </div>
            )}
            
            <p className="text-xs text-muted-foreground mt-2">
              These skills were automatically extracted from your CV. Edit them in your resume and upload again to update.
            </p>
          </div>

          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}







