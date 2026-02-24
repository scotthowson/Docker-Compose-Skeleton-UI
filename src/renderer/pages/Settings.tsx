// =============================================================================
// Settings — Premium settings with connection, appearance, disks, shortcuts
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Cog, Info, HardDrive, Pencil, Check, X, Trash2,
  Keyboard, Timer, Image, Sun, Moon, Palette, Eye,
  Monitor, Shield, Lock, User, UserCircle, Mail,
  Camera, Save, Key, AlertTriangle, XCircle, Plus, FolderPlus,
  Download, Upload, Bell, BellOff, Clock, LockKeyhole,
} from 'lucide-react'
import ConnectionForm from '../components/settings/ConnectionForm'
import AppSettingsForm from '../components/settings/AppSettings'
import { useConnectionStore } from '../stores/connectionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useAuthStore } from '../stores/authStore'
import { usePolling } from '../hooks/usePolling'
import { fetchVersion, fetchDisks } from '../api/endpoints'
import type { APIVersion, DiskInfo, CustomDiskEntry, AppSettings } from '../../shared/types'

// ---------------------------------------------------------------------------
// User Profile Editor
// ---------------------------------------------------------------------------

interface ProfileData {
  displayName: string
  email: string
  icon: string
  bio: string
  statusEmoji: string
  statusText: string
  timezone: string
  accentColor: string
}

function getProfileData(): ProfileData {
  try {
    const raw = localStorage.getItem('user-profile')
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      displayName: parsed.displayName ?? '',
      email: parsed.email ?? '',
      icon: parsed.icon ?? '',
      bio: parsed.bio ?? '',
      statusEmoji: parsed.statusEmoji ?? '',
      statusText: parsed.statusText ?? '',
      timezone: parsed.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      accentColor: parsed.accentColor ?? 'emerald',
    }
  } catch {
    return { displayName: '', email: '', icon: '', bio: '', statusEmoji: '', statusText: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, accentColor: 'emerald' }
  }
}

function saveProfileData(data: ProfileData) {
  localStorage.setItem('user-profile', JSON.stringify(data))
  // Dispatch event so Header re-reads the data
  window.dispatchEvent(new Event('profile-updated'))
}

function ProfileSettings() {
  const { currentUser } = useAuthStore()
  const [profile, setProfile] = useState<ProfileData>(getProfileData)
  const [saved, setSaved] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(profile.icon)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const userInitial = (currentUser?.[0] ?? 'U').toUpperCase()

  const handleChange = (key: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = () => {
    saveProfileData(profile)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleAvatarUrlChange = (url: string) => {
    handleChange('icon', url)
    setAvatarPreview(url)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      handleChange('icon', dataUrl)
      setAvatarPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-5">
      {/* Avatar section */}
      <div className="flex items-start gap-5">
        <div className="relative group">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Profile"
              className="w-20 h-20 rounded-2xl object-cover ring-2 ring-emerald-500/20 shadow-lg"
              onError={() => setAvatarPreview('')}
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-emerald-500/20">
              {userInitial}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="
              absolute inset-0 rounded-2xl flex items-center justify-center
              bg-black/50 opacity-0 group-hover:opacity-100
              transition-opacity duration-200 cursor-pointer
            "
          >
            <Camera size={20} className="text-white" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-200 mb-1">Profile Picture</h4>
          <p className="text-[11px] text-slate-500 mb-2">
            Upload an image or paste a URL. Max 2MB for uploads.
          </p>
          <input
            type="text"
            value={profile.icon}
            onChange={(e) => handleAvatarUrlChange(e.target.value)}
            placeholder="https://example.com/avatar.png"
            className="
              w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
              text-xs text-slate-200 placeholder-slate-600 font-mono
              focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25
              transition-all
            "
          />
        </div>
      </div>

      {/* Display Name */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
          <UserCircle size={12} />
          Display Name
        </label>
        <input
          type="text"
          value={profile.displayName}
          onChange={(e) => handleChange('displayName', e.target.value)}
          placeholder={currentUser ?? 'Your name'}
          className="
            w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg
            text-sm text-slate-200 placeholder-slate-600
            focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25
            transition-all
          "
        />
      </div>

      {/* Email */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
          <Mail size={12} />
          Email Address
        </label>
        <input
          type="email"
          value={profile.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="you@example.com"
          className="
            w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg
            text-sm text-slate-200 placeholder-slate-600
            focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25
            transition-all
          "
        />
      </div>

      {/* Bio */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
          <Pencil size={12} />
          Bio
        </label>
        <textarea
          value={profile.bio}
          onChange={(e) => handleChange('bio', e.target.value)}
          placeholder="A short description about yourself..."
          rows={3}
          className="
            w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg
            text-sm text-slate-200 placeholder-slate-600 resize-none
            focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25
            transition-all
          "
        />
      </div>

      {/* Status */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
          <Eye size={12} />
          Status
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={profile.statusEmoji}
            onChange={(e) => handleChange('statusEmoji', e.target.value.slice(0, 2))}
            placeholder="🟢"
            className="
              w-12 px-2 py-2.5 bg-white/5 border border-white/10 rounded-lg text-center
              text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-all
            "
          />
          <input
            type="text"
            value={profile.statusText}
            onChange={(e) => handleChange('statusText', e.target.value)}
            placeholder="What are you working on?"
            className="
              flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg
              text-sm text-slate-200 placeholder-slate-600
              focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-all
            "
          />
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
          <Clock size={12} />
          Timezone
        </label>
        <select
          value={profile.timezone}
          onChange={(e) => handleChange('timezone', e.target.value)}
          className="
            w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg
            text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50
            focus:ring-1 focus:ring-emerald-500/25 transition-all
          "
        >
          {Intl.supportedValuesOf('timeZone').filter((tz) =>
            tz.startsWith('America/') || tz.startsWith('Europe/') || tz.startsWith('Asia/') || tz.startsWith('Australia/') || tz.startsWith('Pacific/') || tz === 'UTC'
          ).map((tz) => (
            <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Accent Color */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
          <Palette size={12} />
          Accent Color
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'emerald', label: 'Emerald', tw: 'bg-emerald-500' },
            { id: 'cyan', label: 'Cyan', tw: 'bg-cyan-500' },
            { id: 'violet', label: 'Violet', tw: 'bg-violet-500' },
            { id: 'rose', label: 'Rose', tw: 'bg-rose-500' },
            { id: 'amber', label: 'Amber', tw: 'bg-amber-500' },
            { id: 'blue', label: 'Blue', tw: 'bg-blue-500' },
            { id: 'fuchsia', label: 'Fuchsia', tw: 'bg-fuchsia-500' },
            { id: 'lime', label: 'Lime', tw: 'bg-lime-500' },
          ].map((color) => (
            <button
              key={color.id}
              onClick={() => handleChange('accentColor', color.id)}
              title={color.label}
              className={`
                w-8 h-8 rounded-full ${color.tw} transition-all duration-200
                ${profile.accentColor === color.id
                  ? 'ring-2 ring-white/40 ring-offset-2 ring-offset-slate-900 scale-110'
                  : 'opacity-60 hover:opacity-100 hover:scale-105'
                }
              `}
            />
          ))}
        </div>
      </div>

      {/* Account info */}
      <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={12} className="text-slate-500" />
            <span className="text-xs text-slate-500">Username</span>
          </div>
          <span className="text-xs text-slate-300 font-mono">{currentUser ?? '--'}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-slate-500" />
            <span className="text-xs text-slate-500">Local Time</span>
          </div>
          <span className="text-xs text-slate-300 font-mono">
            {new Date().toLocaleTimeString(undefined, { timeZone: profile.timezone, hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
            transition-all duration-300
            ${saved
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30'
            }
          `}
        >
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? 'Saved!' : 'Save Profile'}
        </button>
        {saved && (
          <span className="text-xs text-emerald-400/80 animate-fade-in">
            Profile updated successfully
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Disk Label Manager
// ---------------------------------------------------------------------------

function DiskLabelManager() {
  const diskLabels = useSettingsStore((s) => s.diskLabels) ?? {}
  const customDisks = useSettingsStore((s) => s.customDisks) ?? []
  const updateSetting = useSettingsStore((s) => s.updateSetting)
  const isConnected = useConnectionStore((s) => s.status) === 'connected'

  const { data: diskData } = usePolling(fetchDisks, 60000, { enabled: isConnected })
  const disks: DiskInfo[] = diskData?.disks ?? []

  const [editingMount, setEditingMount] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Custom location form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMount, setNewMount] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [addError, setAddError] = useState('')

  const handleSaveLabel = useCallback((mount: string) => {
    const newLabels = { ...diskLabels }
    if (editValue.trim()) {
      newLabels[mount] = editValue.trim()
    } else {
      delete newLabels[mount]
    }
    updateSetting('diskLabels', newLabels)
    setEditingMount(null)
  }, [diskLabels, editValue, updateSetting])

  const handleRemoveLabel = useCallback((mount: string) => {
    const newLabels = { ...diskLabels }
    delete newLabels[mount]
    updateSetting('diskLabels', newLabels)
  }, [diskLabels, updateSetting])

  // Custom location handlers
  const handleAddCustom = useCallback(() => {
    const mount = newMount.trim()
    const label = newLabel.trim()
    setAddError('')

    if (!mount) {
      setAddError('Mount path is required')
      return
    }
    if (!mount.startsWith('/')) {
      setAddError('Mount path must be absolute (start with /)')
      return
    }
    // Check for duplicate (existing server disk or already-added custom)
    const serverDuplicate = disks.some((d) => d.mount === mount)
    const customDuplicate = customDisks.some((c) => c.mount === mount)
    if (serverDuplicate || customDuplicate) {
      setAddError('This mount path already exists')
      return
    }

    const entry: CustomDiskEntry = { mount, label: label || mount }
    updateSetting('customDisks', [...customDisks, entry])
    // Also set the label in diskLabels if user provided one
    if (label) {
      const newLabels = { ...diskLabels, [mount]: label }
      updateSetting('diskLabels', newLabels)
    }
    setNewMount('')
    setNewLabel('')
    setShowAddForm(false)
  }, [newMount, newLabel, disks, customDisks, diskLabels, updateSetting])

  const handleRemoveCustom = useCallback((mount: string) => {
    const updated = customDisks.filter((c) => c.mount !== mount)
    updateSetting('customDisks', updated)
    // Also clean up the label
    const newLabels = { ...diskLabels }
    delete newLabels[mount]
    updateSetting('diskLabels', newLabels)
  }, [customDisks, diskLabels, updateSetting])

  const handleEditCustomLabel = useCallback((mount: string, label: string) => {
    // Update in customDisks array
    const updated = customDisks.map((c) => c.mount === mount ? { ...c, label } : c)
    updateSetting('customDisks', updated)
    // Also update diskLabels
    const newLabels = { ...diskLabels }
    if (label) {
      newLabels[mount] = label
    } else {
      delete newLabels[mount]
    }
    updateSetting('diskLabels', newLabels)
    setEditingMount(null)
  }, [customDisks, diskLabels, updateSetting])

  return (
    <div className="space-y-4">
      {/* Server-detected disks */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <HardDrive size={14} className="text-cyan-400" />
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Detected Drives</h4>
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Rename server-detected drives for the Dashboard display.
        </p>

        {disks.length === 0 ? (
          <div className="rounded-lg bg-slate-800/30 p-4 text-center">
            <p className="text-xs text-slate-500">
              {isConnected ? 'No disk data available' : 'Connect to server to see detected drives'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {disks.map((disk) => {
              const isEditing = editingMount === disk.mount
              const hasLabel = !!diskLabels[disk.mount]

              return (
                <div
                  key={disk.mount}
                  className="flex items-center gap-3 rounded-lg bg-slate-800/30 px-3 py-2.5 border border-white/[0.03] hover:border-white/[0.06] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-slate-400 truncate" title={disk.mount}>
                      {disk.mount}
                    </p>
                    {hasLabel && !isEditing && (
                      <p className="text-xs text-slate-200 font-medium mt-0.5">{diskLabels[disk.mount]}</p>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                    {disk.used}/{disk.total} ({disk.percent})
                  </span>

                  {isEditing ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' ? handleSaveLabel(disk.mount) : e.key === 'Escape' ? setEditingMount(null) : null}
                        autoFocus
                        placeholder="Custom label..."
                        className="w-32 bg-slate-900/60 border border-emerald-500/30 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      />
                      <button onClick={() => handleSaveLabel(disk.mount)} className="text-emerald-400 hover:text-emerald-300 p-1">
                        <Check size={12} />
                      </button>
                      <button onClick={() => setEditingMount(null)} className="text-slate-500 hover:text-slate-300 p-1">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditValue(diskLabels[disk.mount] ?? ''); setEditingMount(disk.mount) }}
                        className="p-1 text-slate-600 hover:text-slate-400 transition-colors"
                        title="Edit label"
                      >
                        <Pencil size={11} />
                      </button>
                      {hasLabel && (
                        <button
                          onClick={() => handleRemoveLabel(disk.mount)}
                          className="p-1 text-slate-600 hover:text-rose-400 transition-colors"
                          title="Remove label"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.04]" />

      {/* Custom locations */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FolderPlus size={14} className="text-violet-400" />
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Custom Locations</h4>
          </div>
          {!showAddForm && (
            <button
              onClick={() => { setShowAddForm(true); setAddError('') }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/15 hover:border-violet-500/30 transition-all"
            >
              <Plus size={12} />
              Add Location
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Add mount paths not auto-detected by the server (e.g. NFS mounts, external drives).
        </p>

        {/* Existing custom locations */}
        {customDisks.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {customDisks.map((custom) => {
              const isEditing = editingMount === `custom:${custom.mount}`
              return (
                <div
                  key={custom.mount}
                  className="flex items-center gap-3 rounded-lg bg-violet-500/[0.04] border border-violet-500/10 px-3 py-2.5 hover:border-violet-500/20 transition-colors"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-violet-500/10 shrink-0">
                    <FolderPlus size={11} className="text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-slate-400 truncate" title={custom.mount}>
                      {custom.mount}
                    </p>
                    {!isEditing && (
                      <p className="text-xs text-slate-200 font-medium mt-0.5">{custom.label}</p>
                    )}
                  </div>

                  <span className="text-[10px] text-violet-400/60 shrink-0 px-1.5 py-0.5 rounded bg-violet-500/5 border border-violet-500/10">
                    custom
                  </span>

                  {isEditing ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditCustomLabel(custom.mount, editValue.trim())
                          if (e.key === 'Escape') setEditingMount(null)
                        }}
                        autoFocus
                        placeholder="Label..."
                        className="w-32 bg-slate-900/60 border border-violet-500/30 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      />
                      <button onClick={() => handleEditCustomLabel(custom.mount, editValue.trim())} className="text-violet-400 hover:text-violet-300 p-1">
                        <Check size={12} />
                      </button>
                      <button onClick={() => setEditingMount(null)} className="text-slate-500 hover:text-slate-300 p-1">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditValue(custom.label); setEditingMount(`custom:${custom.mount}`) }}
                        className="p-1 text-slate-600 hover:text-violet-400 transition-colors"
                        title="Edit label"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => handleRemoveCustom(custom.mount)}
                        className="p-1 text-slate-600 hover:text-rose-400 transition-colors"
                        title="Remove custom location"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Add custom location form */}
        {showAddForm && (
          <div className="rounded-lg bg-violet-500/[0.04] border border-violet-500/15 p-4 space-y-3 animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <FolderPlus size={14} className="text-violet-400" />
              <span className="text-xs font-semibold text-slate-200">New Custom Location</span>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Mount Path <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={newMount}
                onChange={(e) => { setNewMount(e.target.value); setAddError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                autoFocus
                placeholder="/mnt/external-drive"
                className="
                  w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                  text-xs text-slate-200 placeholder-slate-600 font-mono
                  focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25
                  transition-all
                "
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Display Label
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                placeholder="External Storage"
                className="
                  w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                  text-xs text-slate-200 placeholder-slate-600
                  focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25
                  transition-all
                "
              />
            </div>

            {addError && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-[11px] text-rose-400">
                <XCircle size={12} />
                {addError}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleAddCustom}
                disabled={!newMount.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-50 transition-all shadow-lg shadow-violet-500/20"
              >
                <Plus size={12} />
                Add Location
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewMount(''); setNewLabel(''); setAddError('') }}
                className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {customDisks.length === 0 && !showAddForm && (
          <div className="rounded-lg bg-slate-800/20 border border-dashed border-white/[0.06] p-4 text-center">
            <FolderPlus size={20} className="text-slate-600 mx-auto mb-2" />
            <p className="text-[11px] text-slate-500">
              No custom locations added yet
            </p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              Add NFS shares, USB drives, or other mount points
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Appearance Settings
// ---------------------------------------------------------------------------

function AppearanceSettings() {
  const theme = useSettingsStore((s) => s.theme)
  const backgroundImage = useSettingsStore((s) => s.backgroundImage) ?? ''
  const projectName = useSettingsStore((s) => s.projectName) || 'DCS Manager'
  const projectSubtitle = useSettingsStore((s) => s.projectSubtitle) || 'Docker Compose Skeleton'
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  const [bgInput, setBgInput] = useState(backgroundImage)
  const [nameInput, setNameInput] = useState(projectName)
  const [subtitleInput, setSubtitleInput] = useState(projectSubtitle)

  const handleBgSave = () => {
    updateSetting('backgroundImage', bgInput.trim())
  }

  const handleBgClear = () => {
    setBgInput('')
    updateSetting('backgroundImage', '')
  }

  const presetBackgrounds = [
    { label: 'None', value: '' },
    { label: 'Dark Gradient', value: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80' },
    { label: 'Mountains', value: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80' },
    { label: 'Night Sky', value: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&q=80' },
    { label: 'Ocean', value: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80' },
  ]

  return (
    <div className="space-y-5">
      {/* Branding */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Cog size={14} className="text-emerald-400" />
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Branding</h4>
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Customize the app name shown in the sidebar and login screen.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">App Name</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={() => updateSetting('projectName', nameInput.trim() || 'DCS Manager')}
              onKeyDown={(e) => e.key === 'Enter' && updateSetting('projectName', nameInput.trim() || 'DCS Manager')}
              placeholder="DCS Manager"
              className="
                w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                text-xs text-slate-200 placeholder-slate-600
                focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25
                transition-all
              "
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Subtitle</label>
            <input
              type="text"
              value={subtitleInput}
              onChange={(e) => setSubtitleInput(e.target.value)}
              onBlur={() => updateSetting('projectSubtitle', subtitleInput.trim() || 'Docker Compose Skeleton')}
              onKeyDown={(e) => e.key === 'Enter' && updateSetting('projectSubtitle', subtitleInput.trim() || 'Docker Compose Skeleton')}
              placeholder="Docker Compose Skeleton"
              className="
                w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                text-xs text-slate-200 placeholder-slate-600
                focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25
                transition-all
              "
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.04]" />

      {/* Theme Toggle */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Palette size={16} className="text-violet-400" />
          <h4 className="text-sm font-semibold text-slate-200">Theme</h4>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => updateSetting('theme', 'dark')}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all
              ${theme === 'dark'
                ? 'bg-slate-800 border-emerald-500/30 text-emerald-400 ring-1 ring-emerald-500/20'
                : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/10'
              }
            `}
          >
            <Moon size={14} />
            <span className="text-xs font-medium">Dark</span>
          </button>
          <button
            onClick={() => updateSetting('theme', 'light')}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all
              ${theme === 'light'
                ? 'bg-slate-800 border-amber-500/30 text-amber-400 ring-1 ring-amber-500/20'
                : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/10'
              }
            `}
          >
            <Sun size={14} />
            <span className="text-xs font-medium">Light</span>
          </button>
        </div>
      </div>

      {/* Background Image */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Image size={16} className="text-cyan-400" />
          <h4 className="text-sm font-semibold text-slate-200">Background Image</h4>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Set a custom background image URL (Unsplash, direct URL, etc.)
        </p>

        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={bgInput}
            onChange={(e) => setBgInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBgSave()}
            placeholder="https://images.unsplash.com/..."
            className="
              flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg
              text-xs text-slate-200 placeholder-slate-600 font-mono
              focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25
              transition-all
            "
          />
          <button
            onClick={handleBgSave}
            className="px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 text-xs font-medium hover:bg-emerald-500/25 transition-all"
          >
            Apply
          </button>
          {backgroundImage && (
            <button
              onClick={handleBgClear}
              className="px-3 py-2 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/25 text-xs font-medium hover:bg-rose-500/25 transition-all"
            >
              Clear
            </button>
          )}
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {presetBackgrounds.map((p) => (
            <button
              key={p.label}
              onClick={() => { setBgInput(p.value); updateSetting('backgroundImage', p.value) }}
              className={`
                px-2.5 py-1.5 rounded-md text-[10px] font-medium border transition-all
                ${backgroundImage === p.value
                  ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                  : 'border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/10'
                }
              `}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Preview */}
        {backgroundImage && (
          <div className="mt-3 rounded-lg overflow-hidden border border-white/[0.06] h-24">
            <img
              src={backgroundImage}
              alt="Background preview"
              className="w-full h-full object-cover opacity-60"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Keyboard Shortcuts reference
// ---------------------------------------------------------------------------

function KeyboardShortcuts() {
  const shortcutGroups = [
    {
      group: 'Navigation',
      shortcuts: [
        { keys: 'Ctrl + 1', description: 'Dashboard' },
        { keys: 'Ctrl + 2', description: 'Stacks' },
        { keys: 'Ctrl + 3', description: 'Containers' },
        { keys: 'Ctrl + 4', description: 'Images' },
        { keys: 'Ctrl + 5', description: 'Health Monitor' },
        { keys: 'Ctrl + 6', description: 'Networks' },
        { keys: 'Ctrl + 7', description: 'Logs' },
        { keys: 'Ctrl + 8', description: 'System Info' },
        { keys: 'Ctrl + 9', description: 'Server Config' },
        { keys: 'Ctrl + 0', description: 'Settings' },
      ],
    },
    {
      group: 'Actions',
      shortcuts: [
        { keys: 'Ctrl + K', description: 'Open command palette' },
        { keys: 'Ctrl + R', description: 'Refresh all data' },
        { keys: 'Ctrl + B', description: 'Toggle sidebar' },
        { keys: 'Ctrl + D', description: 'Toggle dark / light mode' },
        { keys: 'Ctrl + F', description: 'Search / Filter current page' },
        { keys: 'Escape', description: 'Close dialogs and modals' },
      ],
    },
  ]

  return (
    <div className="space-y-4">
      {shortcutGroups.map((group) => (
        <div key={group.group}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
            {group.group}
          </p>
          <div className="space-y-0.5">
            {group.shortcuts.map((s) => (
              <div
                key={s.keys}
                className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <span className="text-xs text-slate-400">{s.description}</span>
                <kbd className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-mono text-slate-500">
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Security Settings — Change password, delete account, security info
// ---------------------------------------------------------------------------

function SecuritySettings() {
  const { changePassword, deleteAccount, error, clearError } = useAuthStore()
  const [section, setSection] = useState<'info' | 'password' | 'delete' | null>('info')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [deletePw, setDeletePw] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const handleChangePassword = async () => {
    clearError()
    if (newPw !== confirmPw) {
      return // Handled by UI below
    }
    setPwLoading(true)
    const ok = await changePassword(currentPw, newPw)
    setPwLoading(false)
    if (ok) {
      setPwSuccess(true)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setTimeout(() => { setPwSuccess(false); setSection('info') }, 2500)
    }
  }

  const handleDeleteAccount = async () => {
    clearError()
    await deleteAccount(deletePw)
  }

  return (
    <div className="space-y-4">
      {/* Security info badges */}
      {section === 'info' && (
        <>
          <div className="space-y-2.5">
            <div className="flex items-start gap-3 rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 shrink-0">
                <Lock size={12} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">PBKDF2 Key Derivation</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  100,000 iterations with random salt
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/10 shrink-0">
                <Shield size={12} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">Rate-Limited Login</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  5 attempts before temporary lockout
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 shrink-0">
                <Key size={12} className="text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">Secure Sessions</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Token-based with 4-hour expiry
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => { clearError(); setSection('password') }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.06] text-slate-300 hover:bg-white/[0.08] hover:border-white/10 transition-all"
            >
              <Key size={12} />
              Change Password
            </button>
            <button
              onClick={() => { clearError(); setSection('delete') }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-rose-500/5 border border-rose-500/15 text-rose-400 hover:bg-rose-500/10 transition-all"
            >
              <Trash2 size={12} />
              Delete Account
            </button>
          </div>
        </>
      )}

      {/* Change password form */}
      {section === 'password' && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <Key size={14} className="text-amber-400" />
            <h4 className="text-xs font-semibold text-slate-200">Change Password</h4>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
              <XCircle size={12} />
              {error}
            </div>
          )}
          {pwSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400">
              <Check size={12} />
              Password changed successfully
            </div>
          )}

          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            placeholder="Current password"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-all"
          />
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="New password (min 6, uppercase + number)"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-all"
          />
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Confirm new password"
            className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-all ${
              confirmPw && confirmPw !== newPw ? 'border-rose-500/50' : 'border-white/10 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25'
            }`}
          />
          {confirmPw && confirmPw !== newPw && (
            <p className="text-[10px] text-rose-400">Passwords do not match</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleChangePassword}
              disabled={pwLoading || !currentPw || !newPw || newPw !== confirmPw}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
            >
              {pwLoading ? <Save size={12} className="animate-spin" /> : <Check size={12} />}
              Update Password
            </button>
            <button
              onClick={() => { setSection('info'); clearError(); setCurrentPw(''); setNewPw(''); setConfirmPw('') }}
              className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete account form */}
      {section === 'delete' && (
        <div className="space-y-3 animate-fade-in">
          <div className="rounded-lg bg-rose-500/5 border border-rose-500/20 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-rose-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-rose-300">Danger Zone</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  This will permanently delete your account, profile data, and all settings. This action cannot be undone.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
              <XCircle size={12} />
              {error}
            </div>
          )}

          <input
            type="password"
            value={deletePw}
            onChange={(e) => setDeletePw(e.target.value)}
            placeholder="Enter your password to confirm"
            className="w-full px-3 py-2 bg-white/5 border border-rose-500/20 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/25 transition-all"
          />

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleDeleteAccount}
              disabled={!deletePw}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-rose-500 text-white hover:bg-rose-400 disabled:opacity-50 transition-all"
            >
              <Trash2 size={12} />
              Delete My Account
            </button>
            <button
              onClick={() => { setSection('info'); clearError(); setDeletePw('') }}
              className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Auto-Lock & Notification Preferences
// ---------------------------------------------------------------------------

function AutoLockSettings() {
  const autoLockMinutes = useSettingsStore((s) => s.autoLockMinutes) ?? 0
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled) ?? true
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  const lockOptions = [
    { value: 0, label: 'Never' },
    { value: 5, label: '5 min' },
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' },
  ]

  return (
    <div className="space-y-5">
      {/* Auto-lock */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <LockKeyhole size={14} className="text-amber-400" />
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Auto-Lock</h4>
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Automatically lock the app after a period of inactivity. You'll need to sign in again.
        </p>
        <div className="flex flex-wrap gap-2">
          {lockOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateSetting('autoLockMinutes', opt.value)}
              className={`
                px-3 py-2 rounded-lg text-xs font-medium border transition-all
                ${autoLockMinutes === opt.value
                  ? 'bg-amber-500/15 border-amber-500/25 text-amber-400 ring-1 ring-amber-500/15'
                  : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/10'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {autoLockMinutes > 0 && (
          <p className="text-[10px] text-amber-400/60 mt-2 flex items-center gap-1.5">
            <Clock size={10} />
            Screen will lock after {autoLockMinutes} minute{autoLockMinutes !== 1 ? 's' : ''} of inactivity
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.04]" />

      {/* Notifications */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {notificationsEnabled ? (
              <Bell size={14} className="text-cyan-400" />
            ) : (
              <BellOff size={14} className="text-slate-500" />
            )}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Toast Notifications</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Show in-app notifications for actions and events</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('notificationsEnabled', !notificationsEnabled)}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full
              transition-colors duration-200 focus:outline-none
              ${notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-700'}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white shadow-sm
                transition-transform duration-200
                ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Export / Import Settings
// ---------------------------------------------------------------------------

function ExportImportSettings() {
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(() => {
    const state = useSettingsStore.getState()
    const exportData = {
      _format: 'dcs-ui-settings',
      _version: 1,
      _exportedAt: new Date().toISOString(),
      settings: {
        serverUrl: state.serverUrl,
        pollingInterval: state.pollingInterval,
        containerPollingInterval: state.containerPollingInterval,
        imagePollingInterval: state.imagePollingInterval,
        logPollingInterval: state.logPollingInterval,
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        diskLabels: state.diskLabels,
        pinnedDisks: state.pinnedDisks,
        customDisks: state.customDisks,
        stackAnnotations: state.stackAnnotations,
        backgroundImage: state.backgroundImage,
        autoLockMinutes: state.autoLockMinutes,
        notificationsEnabled: state.notificationsEnabled,
      },
      profile: (() => {
        try {
          const raw = localStorage.getItem('user-profile')
          return raw ? JSON.parse(raw) : null
        } catch { return null }
      })(),
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dcs-ui-settings-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Listen for export-settings event from command palette
  useEffect(() => {
    const handler = () => handleExport()
    window.addEventListener('export-settings', handler)
    return () => window.removeEventListener('export-settings', handler)
  }, [handleExport])

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        if (data._format !== 'dcs-ui-settings') {
          setImportResult({ success: false, message: 'Invalid settings file format' })
          return
        }
        const { settings, profile } = data
        if (settings && typeof settings === 'object') {
          const store = useSettingsStore.getState()
          for (const [key, value] of Object.entries(settings)) {
            store.updateSetting(key as keyof AppSettings, value as never)
          }
        }
        if (profile && typeof profile === 'object') {
          localStorage.setItem('user-profile', JSON.stringify(profile))
          window.dispatchEvent(new Event('profile-updated'))
        }
        setImportResult({ success: true, message: 'Settings imported successfully' })
        setTimeout(() => setImportResult(null), 4000)
      } catch {
        setImportResult({ success: false, message: 'Failed to parse settings file' })
      }
    }
    reader.readAsText(file)
    // Reset input so the same file can be imported again
    e.target.value = ''
  }, [])

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-slate-500">
        Backup your settings, disk labels, stack annotations, and profile data to a JSON file, or restore from a previous export.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/15 hover:border-cyan-500/30 transition-all"
        >
          <Download size={13} />
          Export Settings
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.06] text-slate-300 hover:bg-white/[0.08] hover:border-white/10 transition-all"
        >
          <Upload size={13} />
          Import Settings
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </div>

      {importResult && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs ${
          importResult.success
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
        }`}>
          {importResult.success ? <Check size={12} /> : <XCircle size={12} />}
          {importResult.message}
        </div>
      )}

      <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
        <p className="text-[10px] text-slate-500">
          Exported data includes: connection URL, polling intervals, theme, disk labels, custom disk locations, stack annotations, background image, auto-lock settings, notification preferences, and profile data. Credentials are <strong className="text-slate-400">never</strong> exported.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Session Information
// ---------------------------------------------------------------------------

function SessionInfo() {
  const { currentUser } = useAuthStore()
  const [sessionData, setSessionData] = useState<{ expiresAt?: number; token?: string } | null>(null)
  const [timeLeft, setTimeLeft] = useState('')
  const [lastLogin, setLastLogin] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('auth-session')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          setSessionData(parsed)
        }
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!sessionData?.expiresAt) return
    const expiresAt = sessionData.expiresAt
    const update = () => {
      const diff = expiresAt - Date.now()
      if (diff <= 0) {
        setTimeLeft('Expired')
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setTimeLeft(`${h}h ${m}m remaining`)
    }
    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  }, [sessionData])

  useEffect(() => {
    async function load() {
      try {
        let accounts: Array<{ username: string; lastLoginAt?: string }> = []
        if (window.electronAPI) {
          const result = await window.electronAPI.getSetting('userAccounts')
          accounts = Array.isArray(result) ? result : []
        } else {
          const raw = localStorage.getItem('userAccounts')
          accounts = raw ? JSON.parse(raw) : []
        }
        const account = accounts.find((a) => a.username?.toLowerCase() === (currentUser?.toLowerCase() ?? ''))
        if (account?.lastLoginAt) setLastLogin(account.lastLoginAt)
      } catch { /* ignore */ }
    }
    load()
  }, [currentUser])

  const tokenDisplay = sessionData?.token
    ? `${sessionData.token.slice(0, 8)}...${sessionData.token.slice(-4)}`
    : null

  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Clock size={14} className="text-emerald-400" />
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Session</h4>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[11px] text-slate-500">Status</span>
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        </div>
        {sessionData?.expiresAt && (
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[11px] text-slate-500">Session Expiry</span>
            <span className="text-[11px] text-slate-300 font-mono">{timeLeft}</span>
          </div>
        )}
        {lastLogin && (
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[11px] text-slate-500">Last Login</span>
            <span className="text-[11px] text-slate-300 font-mono">
              {new Date(lastLogin).toLocaleDateString()} {new Date(lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
        {tokenDisplay && (
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[11px] text-slate-500">Session Token</span>
            <span className="text-[11px] text-slate-500 font-mono">
              {tokenDisplay}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section Card helper
// ---------------------------------------------------------------------------

function SectionCard({ icon, title, accentColor, children, fullWidth, defaultCollapsed }: {
  icon: React.ReactNode
  title: string
  accentColor: string
  children: React.ReactNode
  fullWidth?: boolean
  defaultCollapsed?: boolean
}) {
  // Persist collapsed state per card in localStorage
  const storageKey = `settings-card-${title.replace(/\s+/g, '-').toLowerCase()}`
  const [collapsed, setCollapsed] = useState(() => {
    if (defaultCollapsed) return true
    try {
      const saved = localStorage.getItem(storageKey)
      return saved === 'true'
    } catch { return false }
  })

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(storageKey, String(next)) } catch { /* */ }
  }

  return (
    <div className={`glass-subtle rounded-xl overflow-hidden border-t-2 ${accentColor} ${fullWidth ? 'lg:col-span-2' : ''} transition-all duration-300`}>
      <button
        onClick={toggleCollapse}
        className="w-full px-5 py-4 border-b border-white/[0.06] flex items-center gap-2.5 hover:bg-white/[0.02] transition-colors text-left cursor-pointer"
      >
        {icon}
        <h3 className="text-sm font-semibold text-slate-200 flex-1">{title}</h3>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${collapsed ? '-rotate-90' : 'rotate-0'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          collapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'
        }`}
      >
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Settings() {
  const connectionStatus = useConnectionStore((s) => s.status)
  const serverUrl = useConnectionStore((s) => s.serverUrl)

  const [appVersion, setAppVersion] = useState<string>('--')

  // Fetch API version info
  const isConnected = connectionStatus === 'connected'
  const { data: versionData } = usePolling<APIVersion>(fetchVersion, 60000, {
    enabled: isConnected,
  })

  // Load app version from Electron IPC
  useEffect(() => {
    async function loadVersion() {
      if (window.electronAPI) {
        try {
          const v = await window.electronAPI.getVersion()
          setAppVersion(v)
        } catch {
          setAppVersion('unknown')
        }
      } else {
        setAppVersion('dev')
      }
    }
    loadVersion()
  }, [])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100">Settings</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Configure connection, appearance, polling intervals, disk labels, and more
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Row 1: User Profile + Connection (side by side) */}
        <SectionCard
          icon={<UserCircle size={16} className="text-emerald-400" />}
          title="User Profile"
          accentColor="border-t-emerald-500"
        >
          <ProfileSettings />
        </SectionCard>

        <SectionCard
          icon={<Cog size={16} className="text-emerald-400" />}
          title="Connection"
          accentColor="border-t-emerald-500"
        >
          <div className="flex items-center gap-2 mb-4">
            <span
              className={`
                inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium
                ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : connectionStatus === 'connecting'
                      ? 'bg-amber-500/15 text-amber-400'
                      : connectionStatus === 'error'
                        ? 'bg-rose-500/15 text-rose-400'
                        : 'bg-slate-500/15 text-slate-400'
                }
              `}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-400'
                    : connectionStatus === 'connecting'
                      ? 'bg-amber-400 animate-pulse'
                      : connectionStatus === 'error'
                        ? 'bg-rose-400'
                        : 'bg-slate-400'
                }`}
              />
              {connectionStatus}
            </span>
          </div>
          <ConnectionForm />
        </SectionCard>

        {/* Row 2: Appearance (full-width) */}
        <SectionCard
          icon={<Eye size={16} className="text-violet-400" />}
          title="Appearance"
          accentColor="border-t-violet-500"
          fullWidth
        >
          <AppearanceSettings />
        </SectionCard>

        {/* Row 3: App Preferences (full-width) */}
        <SectionCard
          icon={<Timer size={16} className="text-amber-400" />}
          title="Application Preferences"
          accentColor="border-t-amber-500"
          fullWidth
        >
          <AppSettingsForm />
        </SectionCard>

        {/* Row 4: Keyboard Shortcuts + Disk Config (side by side) */}
        <SectionCard
          icon={<Keyboard size={16} className="text-violet-400" />}
          title="Keyboard Shortcuts"
          accentColor="border-t-violet-500"
        >
          <KeyboardShortcuts />
        </SectionCard>

        <SectionCard
          icon={<HardDrive size={16} className="text-cyan-400" />}
          title="Disk Configuration"
          accentColor="border-t-cyan-500"
        >
          <DiskLabelManager />
        </SectionCard>

        {/* Row 5: Auto-Lock & Notifications + Export/Import (side by side) */}
        <SectionCard
          icon={<LockKeyhole size={16} className="text-amber-400" />}
          title="Lock & Notifications"
          accentColor="border-t-amber-500"
        >
          <AutoLockSettings />
        </SectionCard>

        <SectionCard
          icon={<Download size={16} className="text-cyan-400" />}
          title="Backup & Restore"
          accentColor="border-t-cyan-500"
        >
          <ExportImportSettings />
        </SectionCard>

        {/* Row 6: About + Security (side by side) */}
        <SectionCard
          icon={<Info size={16} className="text-cyan-400" />}
          title="About"
          accentColor="border-t-cyan-500"
        >
          <div className="space-y-0">
            {[
              { label: 'App Version', value: appVersion },
              { label: 'API Version', value: versionData?.api_version ?? '--' },
              { label: 'Framework', value: versionData?.framework_version ?? '--' },
              { label: 'Docker', value: versionData?.docker_version ?? '--' },
              { label: 'Compose', value: versionData?.compose_version ?? '--' },
              { label: 'Server URL', value: serverUrl },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-b-0">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{item.label}</span>
                <span className="text-sm text-slate-200 font-mono truncate max-w-[200px]" title={typeof item.value === 'string' ? item.value : undefined}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          icon={<Shield size={16} className="text-rose-400" />}
          title="Security & Account"
          accentColor="border-t-rose-500"
        >
          <SessionInfo />
          <SecuritySettings />
        </SectionCard>
      </div>
    </div>
  )
}
