<template>
  <CentralShell :crumbs="[{ label: 'Settings', route: '/settings' }]">
    <h1 class="text-xl font-semibold text-ink-gray-9">Settings</h1>

    <TabButtons v-model="tab" :buttons="tabs" class="mt-4" />

    <!-- Profile -->
    <div v-if="tab === 'profile'" class="mt-5">
      <div class="divide-y divide-outline-gray-1 rounded-xl border border-outline-gray-2 bg-surface-white">
        <div class="flex items-center gap-3 p-4">
          <Avatar :label="store.user.name || 'You'" size="lg" />
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium text-ink-gray-9">{{ store.user.name || 'You' }}</div>
            <div class="truncate text-sm text-ink-gray-5">{{ store.user.email || '—' }}</div>
          </div>
          <Button variant="subtle" size="sm" label="Edit" icon-left="lucide-pencil" @click="openEdit" />
        </div>
        <div class="flex items-center justify-between gap-3 p-4">
          <div>
            <div class="text-sm font-medium text-ink-gray-9">Notifications</div>
            <div class="text-sm text-ink-gray-5">Choose what we email you about.</div>
          </div>
          <Button variant="subtle" size="sm" label="Manage" @click="notifyOpen = true" />
        </div>
        <div class="flex items-center justify-between gap-3 p-4">
          <div>
            <div class="text-sm font-medium text-ink-gray-9">Two-factor authentication</div>
            <div class="text-sm text-ink-gray-5">Add a second step when signing in.</div>
          </div>
          <Button variant="subtle" size="sm" label="Enable" @click="toast.success('Two-factor setup started')" />
        </div>
      </div>
    </div>

    <!-- ── Team ──────────────────────────────────────────────── -->
    <div v-else-if="tab === 'team'" class="mt-5">
      <!-- Team identity card -->
      <div class="flex items-center gap-4 rounded-xl border border-outline-gray-2 bg-surface-white p-4">
        <div class="relative shrink-0" :class="isAdminOrOwner ? 'cursor-pointer' : ''" @click="isAdminOrOwner && avatarInput && avatarInput.click()">
          <img v-if="store.team.avatar" :src="store.team.avatar" class="size-12 rounded-full object-cover" />
          <div v-else class="grid size-12 place-items-center rounded-full bg-surface-gray-3 text-lg font-semibold text-ink-gray-7">
            {{ teamInitial }}
          </div>
          <div v-if="isAdminOrOwner" class="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-surface-white ring-1 ring-outline-gray-2">
            <span class="lucide-camera size-3 text-ink-gray-5" />
          </div>
        </div>
        <input ref="avatarInput" type="file" accept="image/*" class="hidden" @change="onAvatarChange" />

        <div class="min-w-0 flex-1">
          <div v-if="!editingTeamName" class="group flex items-center gap-2">
            <span class="text-lg font-medium text-ink-gray-9">{{ store.team.name }}</span>
            <button v-if="isAdminOrOwner" class="opacity-0 transition-opacity group-hover:opacity-100" @click="startEditTeamName">
              <span class="lucide-pencil size-3.5 text-ink-gray-4 hover:text-ink-gray-7" />
            </button>
          </div>
          <div v-else class="flex items-center gap-2">
            <input
              ref="teamNameInput"
              v-model="teamNameDraft"
              class="rounded-md border border-outline-gray-3 bg-surface-white px-2 py-1 text-lg font-medium text-ink-gray-9 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              @keydown.enter="saveTeamName"
              @keydown.escape="cancelEditTeamName"
            />
            <Button size="sm" variant="solid" icon="lucide-check" aria-label="Save" @click="saveTeamName" />
            <Button size="sm" icon="lucide-x" aria-label="Cancel" @click="cancelEditTeamName" />
          </div>
        </div>

        <Button variant="subtle" size="sm" label="Invite" icon-left="lucide-plus" @click="openInvite" />
      </div>

      <!-- Member list — full row is clickable -->
      <div class="mt-3 divide-y divide-outline-gray-1 overflow-hidden rounded-xl border border-outline-gray-2">
        <div
          v-for="m in store.members"
          :key="m.id"
          class="flex cursor-pointer items-center gap-3 p-3 hover:bg-surface-gray-1"
          @click="openMemberDialog(m)"
        >
          <!-- Avatar — tooltip for Owner/Admin -->
          <Tooltip v-if="memberIsOwner(m) || memberIsAdmin(m)" text="This role has access to all servers and permissions.">
            <Avatar :label="m.name" size="md" class="shrink-0" />
          </Tooltip>
          <Avatar v-else :label="m.name" size="md" class="shrink-0" />

          <!-- Name + badges -->
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span class="truncate text-sm font-medium text-ink-gray-9">{{ m.name }}</span>
              <Badge v-if="m.invited && !m.inviteExpired" theme="orange" variant="subtle" label="Invited" />
              <template v-else-if="m.invited && m.inviteExpired">
                <Badge theme="red" variant="subtle" label="Expired" />
                <button class="text-xs text-ink-gray-5 underline hover:text-ink-gray-8" @click.stop="doResendInvite(m)">Resend</button>
              </template>
            </div>
            <div class="truncate text-xs text-ink-gray-5">{{ m.email }}</div>
          </div>

          <!-- Role chips -->
          <div class="flex flex-wrap justify-end gap-1" @click.stop>
            <template v-if="memberIsOwner(m)">
              <Badge theme="green" variant="subtle">
                <template #prefix><span class="lucide-crown size-3" /></template>
                Owner
              </Badge>
            </template>
            <template v-else>
              <template v-for="chip in roleChipsFor(m)" :key="chip.roleId">
                <Badge v-if="chip.roleId === 'role-admin'" theme="orange" variant="subtle">
                  <template #prefix><span class="lucide-shield size-3" /></template>
                  Admin
                  <template v-if="chip.serverCount !== null" #suffix>
                    <Tooltip :text="chip.serverNames.join(', ')">
                      <span class="inline-flex min-w-[14px] items-center justify-center rounded-full bg-orange-200 px-0.5 text-[9px] font-semibold leading-none text-orange-900">{{ chip.serverCount }}</span>
                    </Tooltip>
                  </template>
                </Badge>
                <span
                  v-else
                  class="inline-flex items-center rounded-md bg-surface-gray-2 px-2 py-0.5 text-xs text-ink-gray-7"
                >
                  {{ chip.roleName }}
                  <Tooltip v-if="chip.serverCount !== null" :text="chip.serverNames.join(', ')">
                    <span class="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-surface-gray-4 text-[10px] font-semibold leading-none text-ink-gray-7">
                      {{ chip.serverCount }}
                    </span>
                  </Tooltip>
                  <Tooltip v-else-if="chip.isGlobal" text="Applies to all servers">
                    <span class="lucide-globe size-3 ml-1 text-ink-gray-4" />
                  </Tooltip>
                </span>
              </template>
            </template>
          </div>

          <!-- More menu -->
          <Dropdown v-if="memberMenuOptions(m).length" :options="memberMenuOptions(m)" placement="bottom-end" @click.stop>
            <Button variant="ghost" size="sm" icon="lucide-ellipsis-vertical" :aria-label="`Actions for ${m.name}`" @click.stop />
          </Dropdown>
          <div v-else class="size-7 shrink-0" />
        </div>
      </div>
    </div>

    <!-- ── Roles ──────────────────────────────────────────────── -->
    <div v-else-if="tab === 'roles'" class="mt-5">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-semibold text-ink-gray-8">Roles</h2>
          <p class="text-sm text-ink-gray-5">Define roles here, then assign them to people on the Team tab.</p>
        </div>
        <Button variant="subtle" size="sm" label="New role" icon-left="lucide-plus" @click="openRole" />
      </div>

      <div class="mt-3 divide-y divide-outline-gray-1 overflow-hidden rounded-xl border border-outline-gray-2">
        <div
          v-for="r in store.roles"
          :key="r.id"
          class="flex cursor-pointer items-center gap-3 p-3.5 hover:bg-surface-gray-1"
          @click="openRoleDialog(r)"
        >
          <!-- Role icon — amber tile for owner/admin -->
          <span
            class="grid size-8 shrink-0 place-items-center rounded-lg"
            :class="(r.id === 'role-owner' || r.id === 'role-admin') ? 'bg-surface-amber-2' : 'bg-surface-gray-2'"
          >
            <Tooltip v-if="r.id === 'role-owner' || r.id === 'role-admin'" text="This role has access to all servers and permissions.">
              <span class="lucide-shield size-4" :class="(r.id === 'role-owner' || r.id === 'role-admin') ? 'text-ink-amber-3' : 'text-ink-gray-6'" />
            </Tooltip>
            <span v-else class="lucide-user size-4 text-ink-gray-6" />
          </span>

          <!-- Role info -->
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium text-ink-gray-9">{{ r.name }}</div>
            <div class="truncate text-xs text-ink-gray-5">{{ r.desc }}</div>
          </div>

          <!-- Stacked assignee avatars -->
          <div v-if="store.membersForRole(r.id).length" class="flex -space-x-1.5">
            <Tooltip v-for="m in store.membersForRole(r.id).slice(0, 4)" :key="m.id" :text="m.name">
              <Avatar :label="m.name" size="sm" class="ring-2 ring-white" />
            </Tooltip>
            <span
              v-if="store.membersForRole(r.id).length > 4"
              class="inline-flex size-7 items-center justify-center rounded-full bg-surface-gray-3 text-xs font-medium text-ink-gray-7 ring-2 ring-white"
            >
              +{{ store.membersForRole(r.id).length - 4 }}
            </span>
          </div>

          <!-- Delete button -->
          <Button
            v-if="!r.system"
            variant="ghost"
            size="sm"
            icon="lucide-trash-2"
            :aria-label="`Delete ${r.name}`"
            @click.stop="promptDeleteRole(r)"
          />
        </div>
      </div>
    </div>

    <!-- Developer -->
    <div v-else class="mt-5 space-y-5">
      <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-4">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-ink-gray-8">API access</h2>
          <Button variant="subtle" size="sm" label="Regenerate" icon-left="lucide-refresh-cw" @click="regenerate" />
        </div>
        <div class="mt-3 flex items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-gray-2 px-3 py-2">
          <code class="min-w-0 flex-1 truncate font-mono text-sm text-ink-gray-8">{{ store.apiKey }}</code>
          <button class="text-ink-gray-5 hover:text-ink-gray-7" aria-label="Copy" @click="copy(store.apiKey)"><span class="lucide-copy size-4" /></button>
        </div>
      </section>

      <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-4">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-ink-gray-8">SSH keys</h2>
          <Button variant="subtle" size="sm" label="Add SSH key" icon-left="lucide-plus" @click="keyOpen = true" />
        </div>
        <div class="mt-3 divide-y divide-outline-gray-1 rounded-lg border border-outline-gray-2">
          <div v-for="k in store.accountSshKeys" :key="k.id" class="flex items-center gap-3 p-3">
            <span class="lucide-key-round size-4 shrink-0 text-ink-gray-5" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-ink-gray-9">{{ k.name }}</div>
              <div class="truncate font-mono text-xs text-ink-gray-5">{{ k.fingerprint }}</div>
            </div>
            <Button variant="ghost" size="sm" icon="lucide-trash-2" :aria-label="`Remove ${k.name}`" @click="store.removeAccountSshKey(k.id)" />
          </div>
          <div v-if="!store.accountSshKeys.length" class="p-4 text-center text-sm text-ink-gray-5">No SSH keys yet.</div>
        </div>
      </section>

      <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-4">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-ink-gray-8">Webhooks</h2>
          <Button variant="subtle" size="sm" label="Add webhook" icon-left="lucide-plus" @click="hookOpen = true" />
        </div>
        <div class="mt-3 divide-y divide-outline-gray-1 rounded-lg border border-outline-gray-2">
          <div v-for="w in store.webhooks" :key="w.id" class="flex items-center gap-3 p-3">
            <span class="lucide-webhook size-4 shrink-0 text-ink-gray-5" />
            <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">{{ w.url }}</span>
            <Badge theme="green" variant="subtle" label="Active" />
            <Button variant="ghost" size="sm" icon="lucide-trash-2" aria-label="Remove webhook" @click="store.removeWebhook(w.id)" />
          </div>
          <div v-if="!store.webhooks.length" class="p-4 text-center text-sm text-ink-gray-5">No webhooks yet.</div>
        </div>
      </section>
    </div>

    <!-- ── Dialogs ─────────────────────────────────────────── -->

    <Dialog v-model:open="editOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Edit profile</span></template>
      <div class="space-y-3">
        <FormControl v-model="form.name" type="text" label="Name" />
        <FormControl v-model="form.email" type="email" label="Email" />
      </div>
      <template #actions>
        <div class="flex justify-end gap-2"><Button label="Cancel" @click="editOpen = false" /><Button variant="solid" label="Save" @click="saveProfile" /></div>
      </template>
    </Dialog>

    <Dialog v-model:open="notifyOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Notifications</span></template>
      <div class="space-y-3">
        <div v-for="n in notifyRows" :key="n.key" class="flex items-center justify-between gap-3">
          <span class="text-sm text-ink-gray-7">{{ n.label }}</span>
          <Switch v-model="notify[n.key]" />
        </div>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2"><Button label="Cancel" @click="notifyOpen = false" /><Button variant="solid" label="Save" @click="saveNotify" /></div>
      </template>
    </Dialog>

    <Dialog v-model:open="inviteOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Invite to team</span></template>
      <div class="space-y-3">
        <FormControl v-model="invite.email" type="email" label="Email" placeholder="teammate@company.com" />
        <FormControl :modelValue="invite.roleId" type="select" label="Role" :options="roleInviteOptions" @update:modelValue="(v) => { invite.roleId = v; if (v === 'role-owner') invite.resourceId = '' }" />
        <FormControl v-if="invite.roleId !== 'role-owner'" :modelValue="invite.resourceId" type="select" label="Access to" :options="serverSelectOptions" @update:modelValue="(v) => { invite.resourceId = v }" />
        <p v-else class="text-xs text-ink-gray-4">Owner role applies to all servers.</p>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2"><Button label="Cancel" @click="inviteOpen = false" /><Button variant="solid" label="Send invite" :disabled="!invite.email.trim()" @click="sendInvite" /></div>
      </template>
    </Dialog>

    <!-- New role — with permissions -->
    <Dialog v-model:open="roleOpen">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">New role</span></template>
      <div class="space-y-4">
        <FormControl v-model="newRole.name" type="text" label="Name" placeholder="e.g. Support" />
        <FormControl v-model="newRole.desc" type="text" label="Description" placeholder="What can this role do?" />
        <div>
          <div class="mb-2 text-xs font-medium uppercase tracking-wide text-ink-gray-4">Important</div>
          <div class="flex items-center justify-between rounded-lg border border-outline-gray-2 px-3 py-2.5">
            <div>
              <div class="text-sm text-ink-gray-8">Administrator</div>
              <div class="text-xs text-ink-gray-4">Full access to all resources and settings</div>
            </div>
            <Switch
              :modelValue="newRole.permissions.administrator"
              @update:modelValue="(v) => setPermission(newRole.permissions, 'administrator', v)"
            />
          </div>
        </div>
        <div>
          <div class="mb-2 text-xs font-medium uppercase tracking-wide text-ink-gray-4">General</div>
          <div class="divide-y divide-outline-gray-1 overflow-hidden rounded-lg border border-outline-gray-2">
            <div v-for="perm in GENERAL_PERMISSIONS" :key="perm.key" class="flex items-center justify-between px-3 py-2.5">
              <span class="text-sm text-ink-gray-8">{{ perm.label }}</span>
              <Switch
                :modelValue="newRole.permissions[perm.key]"
                @update:modelValue="(v) => setPermission(newRole.permissions, perm.key, v)"
              />
            </div>
          </div>
        </div>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2"><Button label="Cancel" @click="roleOpen = false" /><Button variant="solid" label="Create role" :disabled="!newRole.name.trim()" @click="createRole" /></div>
      </template>
    </Dialog>

    <!-- Role detail dialog -->
    <Dialog v-model:open="roleDialogOpen">
      <template #title>
        <div class="flex items-center gap-2">
          <span class="text-xl font-semibold text-ink-gray-9">{{ roleDialogRole?.name }}</span>
          <Tooltip v-if="roleDialogRole?.id === 'role-owner' || roleDialogRole?.id === 'role-admin'" text="This role has access to all servers and permissions.">
            <span class="lucide-shield size-3.5 text-ink-gray-4" />
          </Tooltip>
        </div>
      </template>
      <div v-if="roleDialogRole">
        <TabButtons
          v-model="roleDialogTab"
          :buttons="[{ label: 'Permissions', value: 'permissions' }, { label: 'Members', value: 'members' }]"
          class="mb-4"
        />

        <!-- Both panels share the same grid cell so the dialog never resizes -->
        <div class="grid">
          <!-- Permissions tab -->
          <div
            class="col-start-1 row-start-1 space-y-4"
            :class="{ 'invisible pointer-events-none': roleDialogTab !== 'permissions' }"
          >
            <div>
              <div class="mb-2 text-xs font-medium uppercase tracking-wide text-ink-gray-4">Important</div>
              <div class="flex items-center justify-between rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2.5">
                <div>
                  <div class="text-sm text-ink-gray-8">Administrator</div>
                  <div class="text-xs text-ink-gray-4">Full access to all resources and settings</div>
                </div>
                <div :class="roleDialogRole.system ? 'pointer-events-none opacity-40' : ''">
                  <Switch :modelValue="roleDialogPerms.administrator" @update:modelValue="(v) => handleRoleDialogPermChange('administrator', v)" />
                </div>
              </div>
            </div>
            <div>
              <div class="mb-2 text-xs font-medium uppercase tracking-wide text-ink-gray-4">General</div>
              <div class="divide-y divide-outline-gray-1 overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-white">
                <div v-for="perm in GENERAL_PERMISSIONS" :key="perm.key" class="flex items-center justify-between px-3 py-2.5">
                  <span class="text-sm text-ink-gray-8">{{ perm.label }}</span>
                  <div :class="roleDialogRole.system ? 'pointer-events-none opacity-40' : ''">
                    <Switch :modelValue="roleDialogPerms[perm.key]" @update:modelValue="(v) => handleRoleDialogPermChange(perm.key, v)" />
                  </div>
                </div>
              </div>
            </div>
            <p v-if="roleDialogRole.system" class="text-xs text-ink-gray-4">Built-in role — permissions cannot be changed.</p>
          </div>

          <!-- Members tab -->
          <div
            class="col-start-1 row-start-1"
            :class="{ 'invisible pointer-events-none': roleDialogTab !== 'members' }"
          >
            <div v-if="store.membersForRole(roleDialogRole.id).length" class="divide-y divide-outline-gray-1">
              <div v-for="m in store.membersForRole(roleDialogRole.id)" :key="m.id" class="flex items-center gap-2 py-2.5">
                <Avatar :label="m.name" size="sm" class="shrink-0" />
                <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">{{ m.name }}</span>
                <span class="shrink-0 text-xs text-ink-gray-4">{{ serverContextFor(m, roleDialogRole.id) }}</span>
              </div>
            </div>
            <p v-else class="py-6 text-center text-sm text-ink-gray-4">No one has this role yet.</p>
          </div>
        </div>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <template v-if="roleDialogTab === 'permissions' && !roleDialogRole?.system">
            <Button label="Cancel" @click="roleDialogOpen = false" />
            <Button variant="solid" label="Save changes" :disabled="!roleDialogDirty" @click="saveRoleDialog" />
          </template>
          <Button v-else label="Close" @click="roleDialogOpen = false" />
        </div>
      </template>
    </Dialog>

    <!-- Member dialog — view roles and manage roles in one modal -->
    <Dialog v-model:open="memberDialogOpen">
      <template #title>
        <div class="flex items-center gap-3">
          <Avatar :label="memberDialogTarget?.name || ''" size="lg" />
          <div>
            <div class="text-xl font-semibold text-ink-gray-9">{{ memberDialogTarget?.name }}</div>
            <div class="text-sm font-normal text-ink-gray-5">{{ memberDialogTarget?.email }}</div>
          </div>
        </div>
      </template>

      <!-- View mode: compact roles table -->
      <div v-if="memberDialogMode === 'view' && memberDialogTarget" class="max-h-[28rem] overflow-y-auto rounded-xl border border-outline-gray-2">
        <div v-for="row in memberDialogRows(memberDialogTarget)" :key="row.key" class="flex items-center gap-3 border-b border-outline-gray-1 px-3 py-2.5 last:border-b-0">
          <span v-if="row.providerId" class="grid size-6 shrink-0 place-items-center rounded text-[9px] font-bold leading-none" :class="row.providerTile">{{ row.providerMono }}</span>
          <span v-else class="grid size-6 shrink-0 place-items-center rounded bg-surface-gray-2">
            <span class="lucide-globe size-3.5 text-ink-gray-5" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm text-ink-gray-8">{{ row.serverLabel }}</div>
            <div class="text-xs text-ink-gray-5">{{ row.roleName }}</div>
          </div>
          <div class="flex shrink-0 flex-wrap justify-end gap-1">
            <span v-if="row.permissions.administrator" class="rounded bg-surface-amber-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-amber-3">Admin</span>
            <span v-for="p in row.enabledPerms" :key="p.key" class="rounded bg-surface-gray-2 px-1.5 py-0.5 text-[10px] text-ink-gray-6">{{ p.short }}</span>
            <span v-if="!row.permissions.administrator && !row.enabledPerms.length" class="text-xs text-ink-gray-4">View only</span>
          </div>
        </div>
      </div>

      <!-- Manage mode: role assignment editor -->
      <div v-else-if="memberDialogMode === 'manage'" class="space-y-3">
        <Alert v-if="draftHasExclusive" theme="yellow" title="Owner and global Admin give full access — they can't be combined with other roles." />
        <div v-for="(dr, i) in draftRoles" :key="i" class="flex items-center gap-2">
          <div class="flex-1">
            <FormControl type="select" :modelValue="dr.roleId" :options="roleSelectOptions" @update:modelValue="(v) => setDraftRoleId(i, v)" />
          </div>
          <span class="shrink-0 text-xs text-ink-gray-4">on</span>
          <div class="flex-1">
            <FormControl type="select" :modelValue="dr.resourceId" :options="serverSelectOptions" @update:modelValue="(v) => setDraftResourceId(i, v)" />
          </div>
          <Button variant="ghost" size="sm" icon="lucide-x" aria-label="Remove" @click="removeDraftRole(i)" />
        </div>
        <Button variant="subtle" size="sm" label="+ Add role for a resource" :disabled="draftHasExclusive" @click="addDraftRole" />
      </div>

      <template #actions>
        <div v-if="memberDialogMode === 'view'" class="flex justify-end">
          <Button
            v-if="isAdminOrOwner && memberDialogTarget && !memberIsOwner(memberDialogTarget)"
            variant="subtle"
            icon-left="lucide-shield"
            label="Manage roles"
            @click="memberDialogMode = 'manage'"
          />
        </div>
        <div v-else class="flex justify-end gap-2">
          <Button icon-left="lucide-arrow-left" label="Back" @click="memberDialogMode = 'view'" />
          <Button variant="solid" label="Save" :disabled="!draftRoles.length" @click="saveManageRoles" />
        </div>
      </template>
    </Dialog>

    <!-- Remove member confirmation -->
    <Dialog v-model:open="removeMemberOpen" size="sm">
      <template #title>
        <span class="text-xl font-semibold text-ink-gray-9">Remove {{ removeMemberTarget?.name }}?</span>
      </template>
      <p class="text-sm text-ink-gray-6">
        They'll immediately lose access to <span class="font-medium text-ink-gray-8">{{ store.team.name }}</span> and all its servers and sites. You can re-invite them at any time.
      </p>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="removeMemberOpen = false" />
          <Button variant="solid" label="Remove" @click="confirmRemoveMember" />
        </div>
      </template>
    </Dialog>

    <Dialog v-model:open="keyOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Add SSH key</span></template>
      <FormControl v-model="keyName" type="text" label="Key name" placeholder="e.g. work-laptop" />
      <template #actions>
        <div class="flex justify-end gap-2"><Button label="Cancel" @click="keyOpen = false" /><Button variant="solid" label="Add key" :disabled="!keyName.trim()" @click="addKey" /></div>
      </template>
    </Dialog>

    <Dialog v-model:open="hookOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Add webhook</span></template>
      <FormControl v-model="hookUrl" type="text" label="Endpoint URL" placeholder="https://example.com/hooks/fc" />
      <template #actions>
        <div class="flex justify-end gap-2"><Button label="Cancel" @click="hookOpen = false" /><Button variant="solid" label="Add webhook" :disabled="!hookUrl.trim()" @click="addHook" /></div>
      </template>
    </Dialog>

    <!-- Leave team -->
    <Dialog v-model:open="leaveOpen" size="sm">
      <template #title>
        <span class="text-xl font-semibold text-ink-gray-9">{{ leaveStep === 1 ? 'Transfer ownership first' : 'Leave team' }}</span>
      </template>
      <div v-if="leaveStep === 1" class="space-y-3">
        <p class="text-sm text-ink-gray-6">You're the Owner. Choose someone to take over before you leave.</p>
        <FormControl v-model="newOwnerForLeave" type="select" label="New owner" :options="nonOwnerMemberOptions" />
      </div>
      <div v-else>
        <p class="text-sm text-ink-gray-6">
          Are you sure you want to leave <span class="font-medium text-ink-gray-8">{{ store.team.name }}</span>? You'll lose access immediately.
        </p>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="leaveOpen = false" />
          <Button v-if="leaveStep === 1" variant="solid" label="Transfer &amp; continue" :disabled="!newOwnerForLeave" @click="pickNewOwner" />
          <Button v-else variant="solid" label="Leave team" @click="confirmLeave" />
        </div>
      </template>
    </Dialog>

    <!-- Delete role -->
    <Dialog v-model:open="deleteRoleOpen" size="sm">
      <template #title>
        <span class="text-xl font-semibold text-ink-gray-9">Delete "{{ deleteTarget?.name }}"</span>
      </template>
      <div class="space-y-3">
        <p class="text-sm text-ink-gray-6">These members have this role. Assign them a new role before deleting.</p>
        <div class="space-y-3">
          <div v-for="({ member, resourceId }, i) in deleteAffected" :key="i" class="flex items-center gap-3">
            <div class="flex min-w-0 flex-1 items-center gap-2">
              <Avatar :label="member.name" size="sm" class="shrink-0" />
              <div class="min-w-0">
                <div class="truncate text-sm font-medium text-ink-gray-9">{{ member.name }}</div>
                <div class="text-xs text-ink-gray-4">on {{ resourceId ? (store.servers.find(s => s.id === resourceId)?.name || 'Server') : 'All servers' }}</div>
              </div>
            </div>
            <div class="w-40 shrink-0">
              <FormControl
                type="select"
                placeholder="New role…"
                :modelValue="reassignMap[member.id + '::' + (resourceId || '')]"
                :options="deleteRoleOptions"
                @update:modelValue="(v) => { reassignMap[member.id + '::' + (resourceId || '')] = v }"
              />
            </div>
          </div>
        </div>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="deleteRoleOpen = false" />
          <Button variant="solid" label="Delete role" :disabled="!deleteReadyToConfirm" @click="confirmDeleteRole" />
        </div>
      </template>
    </Dialog>
  </CentralShell>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { Alert, Avatar, Badge, Button, Dialog, Dropdown, FormControl, Switch, TabButtons, toast, Tooltip } from 'frappe-ui'
import CentralShell from '../../components/CentralShell.vue'
import { useCloudStore } from '../../stores/cloud'
import { providerById, regionById } from '../../data/catalog'

const store = useCloudStore()

const tabs = [
  { label: 'Profile', value: 'profile' },
  { label: 'Team', value: 'team' },
  { label: 'Roles', value: 'roles' },
  { label: 'Developer', value: 'developer' },
]
const tab = ref('profile')

const GENERAL_PERMISSIONS = [
  { key: 'createSites', label: 'Create Sites', short: 'Sites' },
  { key: 'marketplace', label: 'Marketplace', short: 'Market' },
  { key: 'webhooks', label: 'Webhooks', short: 'Hooks' },
  { key: 'billing', label: 'Billing', short: 'Billing' },
]

function makeDefaultPermissions() {
  return { administrator: false, createSites: false, marketplace: false, webhooks: false, billing: false }
}

// ── Permission cascade helper ────────────────────────────────

function setPermission(permissions, key, value) {
  permissions[key] = value
  if (key === 'administrator' && value) {
    Object.keys(permissions).forEach((k) => { permissions[k] = true })
  }
}

// ── Helpers ─────────────────────────────────────────────────

function memberIsOwner(m) {
  return m.roles?.some((r) => r.roleId === 'role-owner')
}
function memberIsAdmin(m) {
  return m.roles?.some((r) => r.roleId === 'role-admin' && !r.resourceId)
}
function isSelf(m) {
  return m.email === store.user.email
}

function roleChipsFor(m) {
  const grouped = {}
  for (const r of m.roles || []) {
    if (!grouped[r.roleId]) grouped[r.roleId] = []
    grouped[r.roleId].push(r.resourceId)
  }
  return Object.entries(grouped).map(([roleId, resourceIds]) => {
    const role = store.roles.find((x) => x.id === roleId)
    if (roleId === 'role-owner') {
      return { roleId, roleName: role?.name || 'Unknown', serverCount: null, serverNames: [], isGlobal: false }
    }
    const hasGlobal = resourceIds.some((id) => id === null)
    const specificIds = resourceIds.filter((id) => id !== null)
    const serverNames = specificIds.map((id) => store.servers.find((s) => s.id === id)?.name || 'Unknown')
    return {
      roleId,
      roleName: role?.name || 'Unknown',
      serverCount: hasGlobal ? null : specificIds.length,
      serverNames: hasGlobal ? [] : serverNames,
      isGlobal: hasGlobal,
    }
  })
}

function serverContextFor(m, roleId) {
  const assignment = m.roles?.find((r) => r.roleId === roleId)
  if (!assignment) return '—'
  if (!assignment.resourceId) return 'All servers'
  return store.servers.find((s) => s.id === assignment.resourceId)?.name || 'All servers'
}

function memberDialogRows(m) {
  if (!m) return []
  return (m.roles || []).map((r) => {
    const role = store.roles.find((x) => x.id === r.roleId)
    const server = r.resourceId ? store.servers.find((s) => s.id === r.resourceId) : null
    const region = server ? regionById(server.regionId) : null
    const provider = region ? providerById(region.providerId) : null
    return {
      key: r.roleId + '::' + (r.resourceId || ''),
      serverLabel: server ? server.name : 'All servers',
      providerId: provider?.id || null,
      providerTile: provider?.tile || '',
      providerMono: provider?.mono || '',
      roleName: role?.name || 'Unknown',
      permissions: role?.permissions || {},
      enabledPerms: GENERAL_PERMISSIONS.filter((p) => role?.permissions?.[p.key]),
    }
  })
}

// ── Computed ─────────────────────────────────────────────────

const loggedInMember = computed(() => store.members.find((m) => m.email === store.user.email))
const isAdminOrOwner = computed(() => {
  const m = loggedInMember.value
  if (!m) return true
  return m.roles?.some((r) => r.roleId === 'role-owner' || r.roleId === 'role-admin')
})
const teamInitial = computed(() => (store.team?.name || 'T')[0].toUpperCase())

const roleSelectOptions = computed(() =>
  store.roles.map((r) => ({ label: r.name, value: r.id, description: r.desc }))
)
const roleInviteOptions = computed(() =>
  store.roles.map((r) => ({ label: r.name, value: r.id, description: r.desc }))
)
const serverSelectOptions = computed(() => [
  { label: 'All servers', value: '' },
  ...store.servers.map((s) => {
    const region = regionById(s.regionId)
    const provider = providerById(region?.providerId)
    return {
      label: s.name,
      value: s.id,
      description: `${region?.name || ''} · ${provider?.short || ''}`,
    }
  }),
])
const nonOwnerMemberOptions = computed(() =>
  store.members
    .filter((m) => !memberIsOwner(m) && !isSelf(m))
    .map((m) => ({ label: m.name, value: m.id }))
)

// ── Profile ──────────────────────────────────────────────────

const editOpen = ref(false)
const form = reactive({ name: '', email: '' })
function openEdit() {
  form.name = store.user.name
  form.email = store.user.email
  editOpen.value = true
}
function saveProfile() {
  store.user.name = form.name.trim() || store.user.name
  store.user.email = form.email.trim() || store.user.email
  toast.success('Profile updated')
  editOpen.value = false
}

const notifyOpen = ref(false)
const notifyRows = [
  { key: 'product', label: 'Product updates' },
  { key: 'billing', label: 'Billing and invoices' },
  { key: 'security', label: 'Security alerts' },
]
const notify = reactive({ product: true, billing: true, security: true })
function saveNotify() {
  toast.success('Notification preferences saved')
  notifyOpen.value = false
}

// ── Team identity ─────────────────────────────────────────────

const avatarInput = ref(null)
const editingTeamName = ref(false)
const teamNameDraft = ref('')
const teamNameInput = ref(null)

function startEditTeamName() {
  teamNameDraft.value = store.team.name
  editingTeamName.value = true
  nextTick(() => teamNameInput.value?.focus())
}
function saveTeamName() {
  store.setTeamName(teamNameDraft.value)
  editingTeamName.value = false
}
function cancelEditTeamName() {
  editingTeamName.value = false
}
function onAvatarChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => store.setTeamAvatar(ev.target.result)
  reader.readAsDataURL(file)
}

// ── Team / members ────────────────────────────────────────────

const inviteOpen = ref(false)
const invite = reactive({ email: '', roleId: 'role-member', resourceId: '' })
function openInvite() {
  invite.email = ''
  invite.roleId = 'role-member'
  invite.resourceId = ''
  inviteOpen.value = true
}
function sendInvite() {
  store.inviteMember(invite.email.trim(), invite.roleId, invite.resourceId || null)
  toast.success('Invite sent')
  inviteOpen.value = false
}
function doResendInvite(m) {
  store.resendInvite(m.id)
  toast.success(`Invite resent to ${m.email}`)
}
const removeMemberOpen = ref(false)
const removeMemberTarget = ref(null)
function removeMember(m) {
  removeMemberTarget.value = m
  removeMemberOpen.value = true
}
function confirmRemoveMember() {
  const m = removeMemberTarget.value
  store.revokeMember(m.id)
  toast.success(`${m.name} removed from team`)
  removeMemberOpen.value = false
  removeMemberTarget.value = null
}

const memberDialogOpen = ref(false)
const memberDialogTarget = ref(null)
const memberDialogMode = ref('view') // 'view' | 'manage'
function openMemberDialog(m) {
  memberDialogTarget.value = m
  memberDialogMode.value = 'view'
  memberDialogOpen.value = true
}

watch(tab, () => {
  roleDialogOpen.value = false
  memberDialogOpen.value = false
  memberDialogMode.value = 'view'
})

function memberMenuOptions(m) {
  const opts = []
  if (isSelf(m)) {
    opts.push({ label: 'Leave team', icon: 'lucide-log-out', onClick: openLeaveTeam })
    return opts
  }
  if (isAdminOrOwner.value) {
    opts.push({ label: 'Manage roles', icon: 'lucide-shield', onClick: () => openManageRoles(m) })
  }
  if (m.inviteExpired) {
    opts.push({ label: 'Resend invite', icon: 'lucide-mail', onClick: () => doResendInvite(m) })
  }
  if (!memberIsOwner(m) && isAdminOrOwner.value) {
    opts.push({ label: 'Remove from team', icon: 'lucide-user-minus', onClick: () => removeMember(m) })
  }
  return opts
}

// ── Manage roles (embedded in member dialog) ───────────────────

const draftRoles = ref([])

const draftHasExclusive = computed(() =>
  draftRoles.value.some((r) =>
    r.roleId === 'role-owner' || (r.roleId === 'role-admin' && !r.resourceId)
  )
)

function setDraftRoleId(i, roleId) {
  draftRoles.value[i].roleId = roleId
  if (roleId === 'role-owner' || (roleId === 'role-admin' && !draftRoles.value[i].resourceId)) {
    draftRoles.value = [{ roleId, resourceId: '' }]
  }
}

function setDraftResourceId(i, resourceId) {
  draftRoles.value[i].resourceId = resourceId
  if (draftRoles.value[i].roleId === 'role-admin' && !resourceId) {
    draftRoles.value = [{ roleId: 'role-admin', resourceId: '' }]
  }
}

function openManageRoles(m) {
  memberDialogTarget.value = m
  memberDialogMode.value = 'manage'
  draftRoles.value = (m.roles || []).map((r) => ({ roleId: r.roleId, resourceId: r.resourceId ?? '' }))
  memberDialogOpen.value = true
}
watch(memberDialogMode, (mode) => {
  if (mode === 'manage' && memberDialogTarget.value) {
    draftRoles.value = (memberDialogTarget.value.roles || []).map((r) => ({ roleId: r.roleId, resourceId: r.resourceId ?? '' }))
  }
})

function addDraftRole() {
  draftRoles.value.push({ roleId: 'role-member', resourceId: '' })
}
function removeDraftRole(i) {
  draftRoles.value.splice(i, 1)
}
function saveManageRoles() {
  const roles = draftRoles.value.map((r) => ({ roleId: r.roleId, resourceId: r.resourceId || null }))
  store.setMemberRoles(memberDialogTarget.value.id, roles)
  toast.success(`Updated roles for ${memberDialogTarget.value.name}`)
  memberDialogMode.value = 'view'
}

// ── Leave team dialog ──────────────────────────────────────────

const leaveOpen = ref(false)
const leaveStep = ref(1)
const newOwnerForLeave = ref('')

function openLeaveTeam() {
  leaveStep.value = memberIsOwner(loggedInMember.value) ? 1 : 2
  newOwnerForLeave.value = ''
  leaveOpen.value = true
}
function pickNewOwner() {
  if (!newOwnerForLeave.value) return
  store.transferOwnership(loggedInMember.value.id, newOwnerForLeave.value)
  leaveStep.value = 2
}
function confirmLeave() {
  store.revokeMember(loggedInMember.value?.id)
  toast.success('You have left the team')
  leaveOpen.value = false
}

// ── Role detail dialog ─────────────────────────────────────────

const roleDialogOpen = ref(false)
const roleDialogRole = ref(null)
const roleDialogTab = ref('permissions')
const roleDialogPerms = reactive({})
const roleDialogDirty = ref(false)

watch(roleDialogOpen, (open) => {
  if (open && roleDialogRole.value) {
    Object.keys(roleDialogPerms).forEach((k) => delete roleDialogPerms[k])
    Object.assign(roleDialogPerms, { ...roleDialogRole.value.permissions })
    roleDialogDirty.value = false
    roleDialogTab.value = 'permissions'
  }
})

function openRoleDialog(r) {
  roleDialogRole.value = r
  roleDialogOpen.value = true
}

function handleRoleDialogPermChange(key, value) {
  if (!roleDialogRole.value?.id || roleDialogRole.value.system) return
  setPermission(roleDialogPerms, key, value)
  roleDialogDirty.value = true
}

function saveRoleDialog() {
  if (!roleDialogRole.value || roleDialogRole.value.system) return
  Object.entries(roleDialogPerms).forEach(([key, value]) => {
    store.setRolePermission(roleDialogRole.value.id, key, value)
  })
  toast.success('Role updated')
  roleDialogOpen.value = false
}

// ── Delete role dialog ─────────────────────────────────────────

const deleteRoleOpen = ref(false)
const deleteTarget = ref(null)
const deleteAffected = ref([])
const reassignMap = reactive({})

const deleteRoleOptions = computed(() =>
  store.roles
    .filter((r) => r.id !== deleteTarget.value?.id && r.id !== 'role-owner')
    .map((r) => ({ label: r.name, value: r.id, description: r.desc }))
)
const deleteReadyToConfirm = computed(() => {
  if (!deleteAffected.value.length) return false
  return deleteAffected.value.every(({ member, resourceId }) => !!reassignMap[member.id + '::' + (resourceId || '')])
})

function promptDeleteRole(r) {
  const affected = []
  for (const m of store.members) {
    for (const assignment of m.roles || []) {
      if (assignment.roleId === r.id) affected.push({ member: m, resourceId: assignment.resourceId })
    }
  }
  if (!affected.length) {
    store.removeRole(r.id)
    toast.success(`Deleted "${r.name}"`)
    return
  }
  deleteTarget.value = r
  deleteAffected.value = affected
  Object.keys(reassignMap).forEach((k) => delete reassignMap[k])
  deleteRoleOpen.value = true
}
function confirmDeleteRole() {
  for (const { member, resourceId } of deleteAffected.value) {
    const key = member.id + '::' + (resourceId || '')
    const newRoleId = reassignMap[key]
    if (newRoleId) {
      const newRoles = (member.roles || []).map((r) =>
        r.roleId === deleteTarget.value.id && r.resourceId === resourceId ? { roleId: newRoleId, resourceId } : r
      )
      store.setMemberRoles(member.id, newRoles)
    }
  }
  store.removeRole(deleteTarget.value.id)
  toast.success(`Deleted "${deleteTarget.value.name}"`)
  deleteRoleOpen.value = false
  deleteTarget.value = null
}

// ── New role dialog ────────────────────────────────────────────

const roleOpen = ref(false)
const newRole = reactive({ name: '', desc: '', permissions: makeDefaultPermissions() })
function openRole() {
  newRole.name = ''
  newRole.desc = ''
  newRole.permissions = makeDefaultPermissions()
  roleOpen.value = true
}
function createRole() {
  store.addRole({ name: newRole.name.trim(), desc: newRole.desc.trim(), permissions: { ...newRole.permissions } })
  toast.success('Role created')
  roleOpen.value = false
}

// ── Developer ─────────────────────────────────────────────────

function regenerate() {
  store.regenerateApiKey()
  toast.success('API secret regenerated')
}
function copy(text) {
  navigator.clipboard?.writeText(text)
  toast.success('Copied')
}
const keyOpen = ref(false)
const keyName = ref('')
function addKey() {
  store.addAccountSshKey({ name: keyName.value.trim() })
  toast.success('SSH key added')
  keyOpen.value = false
  keyName.value = ''
}
const hookOpen = ref(false)
const hookUrl = ref('')
function addHook() {
  store.addWebhook({ url: hookUrl.value.trim() })
  toast.success('Webhook added')
  hookOpen.value = false
  hookUrl.value = ''
}
</script>
