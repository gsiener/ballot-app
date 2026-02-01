---
title: Add Attendance Rename Functionality to Admin Panel
tags:
  - admin
  - attendance
  - rename
  - CRUD
  - inline-editing
  - api
  - ui
category: feature-additions
module:
  - admin-panel
  - attendance-api
  - server
symptoms:
  - Unable to rename attendances from admin panel
  - No edit functionality for attendance names
  - Admin users had to delete and recreate attendances to change names
severity: low
date_discovered: 2026-02-01
files_modified:
  - server/src/index.ts
  - client/src/api/client.ts
  - client/src/components/AdminPanel.tsx
---

# Add Attendance Rename Functionality to Admin Panel

## Problem

Users could not rename Attendances from the admin panel. The only way to change an attendance title was to delete and recreate it, losing all existing responses.

## Solution

Implemented end-to-end attendance rename capability across three layers:

1. **Server**: PATCH `/api/attendance/:id` endpoint with admin authentication
2. **Client API**: `attendanceApi.rename()` function for API communication
3. **Admin UI**: Inline rename with Pencil icon button trigger

## Implementation

### 1. Server Endpoint (`server/src/index.ts`)

Added PATCH endpoint with admin authentication and OpenTelemetry instrumentation:

```typescript
app.patch('/api/attendance/:id', adminAuth, async (c) => {
  const span = createSpan('admin_rename_attendance')
  const id = c.req.param('id')

  try {
    const { title } = await c.req.json()

    // Validate title
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return c.json({ error: 'Title is required' }, 400)
    }

    if (title.trim().length > MAX_ATTENDANCE_TITLE_LENGTH) {
      return c.json({ error: `Title must be ${MAX_ATTENDANCE_TITLE_LENGTH} characters or less` }, 400)
    }

    const attendances = await getAllAttendances(c.env.BALLOTS_KV)
    const attendanceIndex = attendances.findIndex(a => a.id === id)

    if (attendanceIndex === -1) {
      return c.json({ error: 'Attendance not found' }, 404)
    }

    // Update title and timestamp
    const attendance = attendances[attendanceIndex]!
    const oldTitle = attendance.title
    attendance.title = title.trim()
    attendance.updatedAt = new Date().toISOString()
    attendances[attendanceIndex] = attendance
    await saveAttendances(c.env.BALLOTS_KV, attendances)

    recordSpanEvent('admin_attendance_renamed', {
      'attendance.id': id,
      'attendance.old_title': oldTitle,
      'attendance.new_title': attendance.title,
      'admin.user': 'authenticated'
    })

    return c.json(attendance)
  } finally {
    span.end()
  }
})
```

### 2. Client API (`client/src/api/client.ts`)

Added rename method to attendance API:

```typescript
rename: async (adminKey: string, id: string, title: string): Promise<Attendance> => {
  const response = await fetch(`${API_BASE_URL}/api/attendance/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title })
  })
  return handleResponse<Attendance>(response)
}
```

### 3. Admin Panel UI (`client/src/components/AdminPanel.tsx`)

Added inline editing with state management:

```typescript
// State
const [renamingAttendance, setRenamingAttendance] = useState<string | null>(null)
const [renameValue, setRenameValue] = useState<string>('')

// Handlers
const handleRenameAttendance = async (attendanceId: string) => {
  if (!adminKey || !renameValue.trim()) return

  try {
    const updatedAttendance = await attendanceApi.rename(adminKey, attendanceId, renameValue.trim())
    setAttendances(prev =>
      prev.map(attendance =>
        attendance.id === attendanceId
          ? { ...attendance, title: updatedAttendance.title }
          : attendance
      )
    )
    setToast('Attendance renamed successfully')
    setRenamingAttendance(null)
    setRenameValue('')
  } catch (error) {
    alert('Failed to rename attendance. Please try again.')
  }
}

const startRenaming = (attendanceId: string, currentTitle: string) => {
  setRenamingAttendance(attendanceId)
  setRenameValue(currentTitle)
}

const cancelRenaming = () => {
  setRenamingAttendance(null)
  setRenameValue('')
}
```

UI with inline edit mode:

```tsx
{isRenaming ? (
  <div className="flex items-center gap-2 mb-2">
    <input
      type="text"
      value={renameValue}
      onChange={(e) => setRenameValue(e.target.value)}
      autoFocus
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleRenameAttendance(attendance.id)
        if (e.key === 'Escape') cancelRenaming()
      }}
    />
    <Button size="sm" onClick={() => handleRenameAttendance(attendance.id)}>Save</Button>
    <Button variant="outline" size="sm" onClick={cancelRenaming}>Cancel</Button>
  </div>
) : (
  <h3>{attendance.title}</h3>
)}

{!isRenaming && (
  <Button variant="outline" size="sm" onClick={() => startRenaming(attendance.id, attendance.title)}>
    <Pencil className="w-4 h-4" />
    Rename
  </Button>
)}
```

## Key Features

- **Admin Authentication**: Uses `adminAuth` middleware requiring `Authorization: Bearer <ADMIN_API_KEY>`
- **Input Validation**: Title must be non-empty and within `MAX_ATTENDANCE_TITLE_LENGTH`
- **OpenTelemetry Instrumentation**: Full span tracking for audit trail
- **Keyboard Shortcuts**: Enter saves, Escape cancels
- **Optimistic UI Update**: Local state updates after server confirms
- **Toast Notification**: Success feedback to user

## Patterns Used

This implementation follows existing patterns in the codebase:

| Pattern | Example |
|---------|---------|
| Admin middleware | Same as `DELETE /api/admin/ballots/:id` |
| Span naming | `admin_<action>_<resource>` convention |
| Audit events | `recordSpanEvent('admin_attendance_renamed', {...})` |
| Client API | Similar to `adminApi.togglePrivacy()` |
| Inline editing | New pattern, but consistent with React best practices |

## Testing Considerations

### Server Tests

- Authentication required (401 without valid key)
- Validation: empty title (400), title too long (400)
- Not found (404 for invalid ID)
- Success returns updated attendance
- Telemetry spans created with correct attributes

### Client Tests

- Rename button shows Pencil icon
- Click triggers inline edit mode
- Enter key submits, Escape cancels
- Success updates local state and shows toast
- Error shows alert dialog

## Prevention Strategies

1. **Always use adminAuth middleware** for admin mutations
2. **Validate on server side** - never trust client input
3. **Follow telemetry conventions** for consistent audit trails
4. **Update timestamps** when modifying records
5. **Support keyboard shortcuts** for better UX

## Related Documentation

- `CLAUDE.md` - Admin routes documentation
- `TEST_COVERAGE.md` - Admin API test patterns
- `ARCHITECTURE_DECISIONS.md` - ADR-003 (OpenTelemetry), ADR-006 (KV Persistence)
