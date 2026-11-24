# Database & Storage Least-Privilege Policy Patterns

Use these reference templates and anti-pattern checks during **Step 5 (Secure)** alongside [SKILL.md](../SKILL.md) whether the project uses **Firebase** or **PostgreSQL / Supabase**.

---

## 1. Firebase Firestore & Cloud Storage Security Rules

### Anti-Patterns (`FAIL` Immediately)
- Open wildcard access: `allow read, write: if true;` or timestamp backdoors (`request.time < timestamp.date(...)`).
- Auth-only without ownership check on multi-tenant data: `allow read, write: if request.auth != null;` (allows any signed-in user to read/modify another user's documents — IDOR).
- Unbounded collection `list` queries without `request.query.limit`.
- Mutable `ownerId`, `role`, or `createdAt` on `update` (privilege escalation / ownership hijacking).
- Storage uploads without `request.resource.size` and `request.resource.contentType` enforcement.

### Least-Privilege Firestore Template (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isValidTaskPayload(data, ownerId) {
      return data.keys().hasAll(['title', 'stage', 'completed', 'ownerId', 'createdAt', 'updatedAt'])
        && data.keys().hasOnly(['title', 'stage', 'completed', 'ownerId', 'createdAt', 'updatedAt'])
        && data.ownerId == ownerId
        && data.title is string
        && data.title.size() >= 1
        && data.title.size() <= 80
        && data.stage in ['Plan', 'Design', 'Build', 'Verify', 'Secure', 'Ship']
        && data.completed is bool
        && data.createdAt is timestamp
        && data.updatedAt is timestamp;
    }

    match /users/{userId}/tasks/{taskId} {
      allow get: if isOwner(userId);
      allow list: if isOwner(userId)
        && request.query.limit != null
        && request.query.limit <= 100;

      allow create: if isOwner(userId)
        && isValidTaskPayload(request.resource.data, userId);

      allow update: if isOwner(userId)
        && isValidTaskPayload(request.resource.data, userId)
        && request.resource.data.ownerId == resource.data.ownerId
        && request.resource.data.createdAt == resource.data.createdAt;

      allow delete: if isOwner(userId);
    }

    // Explicit root default-deny fallback
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Least-Privilege Cloud Storage Template (`storage.rules`)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/attachments/{fileName} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create, update: if request.auth != null
        && request.auth.uid == userId
        && request.resource.size <= 5 * 1024 * 1024
        && request.resource.contentType.matches('image/(png|jpeg|webp)|application/pdf');
      allow delete: if request.auth != null && request.auth.uid == userId;
    }

    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 2. Supabase / PostgreSQL Row-Level Security (RLS)

### Anti-Patterns (`FAIL` Immediately)
- Public schema tables exposed to PostgREST / client SDKs without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` (grants unrestricted table access to `anon` / `authenticated` roles by default).
- Policies using `USING (true)` or `WITH CHECK (true)` on private user rows or mutation operations.
- `UPDATE` policies with `USING ((select auth.uid()) = user_id)` but missing an explicit `WITH CHECK ((select auth.uid()) = user_id)` (allows a user to transfer row ownership to another `user_id` if column grants aren't restricted).
- Calling `auth.uid() = user_id` directly instead of `(select auth.uid()) = user_id` (prevents Postgres initPlan caching per statement) or missing a B-tree index on `user_id`.

### Least-Privilege PostgreSQL / Supabase RLS Template

```sql
-- 1. Enforce schema constraints + enable RLS before exposing table
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  stage text not null check (stage in ('Plan', 'Design', 'Build', 'Verify', 'Secure', 'Ship')),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index RLS filter column so policy evaluation stays O(log n)
create index tasks_user_id_idx on public.tasks using btree (user_id);

alter table public.tasks enable row level security;

-- 2. Separate per-operation policies scoped to `authenticated` role
create policy "tasks_select_own"
  on public.tasks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "tasks_insert_own"
  on public.tasks
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "tasks_update_own"
  on public.tasks
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "tasks_delete_own"
  on public.tasks
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 3. Guard immutable columns (user_id, created_at) on UPDATE
create or replace function public.prevent_immutable_task_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'created_at is immutable';
  end if;
  return new;
end;
$$;

create trigger trg_tasks_immutable_fields
  before update on public.tasks
  for each row
  execute function public.prevent_immutable_task_mutation();
```
