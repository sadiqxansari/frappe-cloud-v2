<template>
  <CentralShell :crumbs="[{ label: 'Team & Permissions', route: '/settings' }]">
    <h1 class="text-xl font-semibold text-ink-gray-9">Team &amp; Permissions</h1>

    <TabButtons v-model="tab" :buttons="tabs" class="mt-4" />

    <!-- ── Team ──────────────────────────────────────────────── -->
    <div v-if="tab === 'team'" class="mt-5">
      <!-- Team identity card -->
      <div class="flex items-center gap-4 rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-4">
        <div class="relative shrink-0" :class="isAdminOrOwner ? 'cursor-pointer' : ''" @click="isAdminOrOwner && avatarInput && avatarInput.click()">
          <img v-if="store.team.avatar" :src="store.team.avatar" class="size-12 rounded-full object-cover" />
          <div v-else class="grid size-12 place-items-center rounded-full bg-surface-gray-3 text-lg font-semibold text-ink-gray-7">
            {{ teamInitial }}
          </div>
          <div v-if="isAdminOrOwner" class="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-surface-elevation-1 ring-1 ring-outline-gray-2">
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
              class="rounded-md border border-outline-gray-3 bg-surface-elevation-1 px-2 py-1 text-lg font-medium text-ink-gray-9 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              @keydown.enter="saveTeamName"
              @keydown.escape="cancelEditTeamName"
            />
            <Button size="sm" variant="solid" icon="lucide-check" aria-label="Save" @click="saveTeamName" />
            <Button size="sm" icon="lucide-x" aria-label="Cancel" @click="cancelEditTeamName" />
          </div>
        </div>

        <Button variant="subtle" size="sm" label="Invite" icon-left="lucide-plus" @click="openInvite" />
      </div>

      <!-- Search across name / email / role (issue #12) -->
      <FormControl
        v-if="store.members.length > 4"
        v-model="memberQuery"
        class="mt-4"
        type="text"
        size="sm"
        placeholder="Search members by name, email or role…"
      >
        <template #prefix><span class="lucide-search size-4 text-ink-gray-4" /></template>
      </FormControl>

      <!-- Member list — full row is clickable -->
      <div class="mt-3 divide-y divide-outline-alpha-gray-1 overflow-hidden rounded-xl border border-outline-gray-2">
        <div
          v-for="m in filteredMembers"
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
                      <span class="inline-flex min-w-[14px] items-center justify-center rounded-full bg-orange-200 px-0.5 text-[9px] font-semibold text-orange-900">{{ chip.serverCount }}</span>
                    </Tooltip>
                  </template>
                </Badge>
                <span
                  v-else
                  class="inline-flex items-center rounded-md bg-surface-gray-2 px-2 py-0.5 text-xs text-ink-gray-7"
                >
                  {{ chip.roleName }}
                  <Tooltip v-if="chip.serverCount !== null" :text="chip.serverNames.join(', ')">
                    <span class="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-surface-gray-4 text-[10px] font-semibold text-ink-gray-7">
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
        <p v-if="!filteredMembers.length" class="p-6 text-center text-p-sm text-ink-gray-4">
          No members match “{{ memberQuery }}”.
        </p>
      </div>

      <!-- Frappe Partner -->
      <div class="mt-4 rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-ink-gray-8">Frappe Partner</h2>
            <p class="mt-0.5 text-p-sm text-ink-gray-5">Manage partner access to your account</p>
          </div>
          <Button
            variant="subtle"
            size="sm"
            :icon-left="store.partnerCode ? 'lucide-pencil' : 'lucide-square-pen'"
            :label="store.partnerCode ? 'Change Partner Code' : 'Add Partner Code'"
            @click="openPartner"
          />
        </div>
        <p v-if="store.partnerCode" class="mt-3 text-p-sm text-ink-gray-6">
          Linked to Partner code <span class="font-mono font-medium text-ink-gray-8">{{ store.partnerCode }}</span>.
        </p>
        <p v-else class="mt-3 text-p-sm text-ink-gray-6">
          Have a Frappe Partner Referral Code? Click on <span class="font-medium text-ink-gray-8">Add Partner Code</span> to link with your Partner team.
        </p>
      </div>
    </div>

    <!-- ── Roles ──────────────────────────────────────────────── -->
    <div v-else-if="tab === 'roles'" class="mt-5">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-semibold text-ink-gray-8">Roles</h2>
          <p class="text-p-sm text-ink-gray-5">Define roles here, then assign them to people on the Team tab.</p>
        </div>
        <Button variant="subtle" size="sm" label="New role" icon-left="lucide-plus" @click="openRole" />
      </div>

      <!-- Search roles (issue #12) -->
      <FormControl
        v-if="store.roles.length > 4"
        v-model="roleQuery"
        class="mt-4"
        type="text"
        size="sm"
        placeholder="Search roles…"
      >
        <template #prefix><span class="lucide-search size-4 text-ink-gray-4" /></template>
      </FormControl>

      <div class="mt-3 divide-y divide-outline-alpha-gray-1 overflow-hidden rounded-xl border border-outline-gray-2">
        <div
          v-for="r in filteredRoles"
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
              <span class="lucide-shield size-4" :class="(r.id === 'role-owner' || r.id === 'role-admin') ? 'text-ink-amber-8' : 'text-ink-gray-6'" />
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
              <Avatar :label="m.name" size="sm" class="ring-2 ring-[var(--surface-elevation-1)]" />
            </Tooltip>
            <span
              v-if="store.membersForRole(r.id).length > 4"
              class="inline-flex size-7 items-center justify-center rounded-full bg-surface-gray-3 text-xs font-medium text-ink-gray-7 ring-2 ring-[var(--surface-elevation-1)]"
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
        <p v-if="!filteredRoles.length" class="p-6 text-center text-p-sm text-ink-gray-4">
          No roles match “{{ roleQuery }}”.
        </p>
      </div>
    </div>

    <!-- ── Dialogs ─────────────────────────────────────────── -->

    <Dialog v-model:open="partnerOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Add Partner Code</span></template>
      <FormControl v-model="partnerDraft" type="text" label="Partner Referral Code" placeholder="e.g. ABC123" />
      <p class="mt-2 text-p-sm text-ink-gray-5">Link your account with a Frappe Partner team using their referral code.</p>
      <template #actions>
        <div class="flex justify-end gap-2"><Button label="Cancel" @click="partnerOpen = false" /><Button variant="solid" label="Link" :disabled="!partnerDraft.trim()" @click="savePartner" /></div>
      </template>
    </Dialog>

    <Dialog v-model:open="inviteOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Invite to team</span></template>
      <div class="space-y-3">
        <FormControl v-model="invite.email" type="email" label="Email" placeholder="teammate@company.com" />
        <FormControl :modelValue="invite.roleId" type="select" label="Role" :options="roleInviteOptions" @update:modelValue="(v) => { invite.roleId = v; if (v === 'role-owner') invite.resourceId = '' }" />
        <FormControl v-if="invite.roleId !== 'role-owner'" :modelValue="invite.resourceId" type="select" label="Access to" :options="serverSelectOptions" @update:modelValue="(v) => { invite.resourceId = v }" />
        <p v-else class="text-p-xs text-ink-gray-4">Owner role applies to all servers.</p>
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
          <div class="divide-y divide-outline-alpha-gray-1 overflow-hidden rounded-lg border border-outline-gray-2">
            <div v-for="perm in GENERAL_PERMISSIONS" :key="perm.key" class="flex items-center justify-between px-3 py-2.5">
              <div>
                <span class="text-sm text-ink-gray-8">{{ perm.label }}</span>
                <p v-if="permLocked(perm, newRole.permissions)" class="text-p-xs text-ink-gray-4">Available to Admin roles only</p>
              </div>
              <Switch
                :modelValue="newRole.permissions[perm.key]"
                :disabled="permLocked(perm, newRole.permissions)"
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
              <div class="flex items-center justify-between rounded-lg border border-outline-gray-2 bg-surface-elevation-1 px-3 py-2.5">
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
              <div class="divide-y divide-outline-alpha-gray-1 overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-elevation-1">
                <div v-for="perm in GENERAL_PERMISSIONS" :key="perm.key" class="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <span class="text-sm text-ink-gray-8">{{ perm.label }}</span>
                    <p v-if="!roleDialogRole.system && permLocked(perm, roleDialogPerms)" class="text-p-xs text-ink-gray-4">Available to Admin roles only</p>
                  </div>
                  <div :class="roleDialogRole.system ? 'pointer-events-none opacity-40' : ''">
                    <Switch
                      :modelValue="roleDialogPerms[perm.key]"
                      :disabled="permLocked(perm, roleDialogPerms)"
                      @update:modelValue="(v) => handleRoleDialogPermChange(perm.key, v)"
                    />
                  </div>
                </div>
              </div>
            </div>
            <p v-if="roleDialogRole.system" class="text-p-xs text-ink-gray-4">Built-in role — permissions cannot be changed.</p>
          </div>

          <!-- Members tab -->
          <div
            class="col-start-1 row-start-1"
            :class="{ 'invisible pointer-events-none': roleDialogTab !== 'members' }"
          >
            <div v-if="store.membersForRole(roleDialogRole.id).length" class="divide-y divide-outline-alpha-gray-1">
              <div v-for="m in store.membersForRole(roleDialogRole.id)" :key="m.id" class="flex items-center gap-2 py-2.5">
                <Avatar :label="m.name" size="sm" class="shrink-0" />
                <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">{{ m.name }}</span>
                <span class="shrink-0 text-xs text-ink-gray-4">{{ serverContextFor(m, roleDialogRole.id) }}</span>
              </div>
            </div>
            <p v-else class="py-6 text-center text-p-sm text-ink-gray-4">No one has this role yet.</p>

            <!-- Add an existing team member directly — no invite (issue #7).
                 Pick the member and which resource the role applies to (issue #16).
                 Assigning the Owner role transfers ownership, so it's owner-only. -->
            <div v-if="isAdminOrOwner && (roleDialogRole.id !== 'role-owner' || loggedInIsOwner)" class="mt-3 border-t border-outline-alpha-gray-1 pt-3">
              <template v-if="addableMemberOptions(roleDialogRole.id).length">
                <div class="flex items-end gap-2">
                  <div class="min-w-0 flex-1">
                    <FormControl
                      type="select"
                      label="Team member"
                      placeholder="Choose…"
                      :modelValue="addMember.memberId"
                      :options="addableMemberOptions(roleDialogRole.id)"
                      @update:modelValue="(v) => (addMember.memberId = v)"
                    />
                  </div>
                  <div v-if="roleDialogRole.id !== 'role-owner'" class="min-w-0 flex-1">
                    <FormControl
                      type="select"
                      label="Access to"
                      :modelValue="addMember.resourceId"
                      :options="serverSelectOptions"
                      @update:modelValue="(v) => (addMember.resourceId = v)"
                    />
                  </div>
                  <Button class="shrink-0" variant="subtle" label="Add" :disabled="!addMember.memberId" @click="confirmAddMemberToRole" />
                </div>
              </template>
              <p v-else class="text-center text-p-xs text-ink-gray-4">Everyone on the team already has this role.</p>
              <p v-if="roleDialogRole.id === 'role-owner'" class="mt-1.5 text-p-xs text-ink-gray-4">
                There's only one Owner — adding someone transfers ownership to them.
              </p>
            </div>
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
        <div v-for="row in memberDialogRows(memberDialogTarget)" :key="row.key" class="flex items-center gap-3 border-b border-outline-alpha-gray-1 px-3 py-2.5 last:border-b-0">
          <span v-if="row.providerId" class="grid size-6 shrink-0 place-items-center rounded text-[9px] font-bold" :class="row.providerTile">{{ row.providerMono }}</span>
          <span v-else class="grid size-6 shrink-0 place-items-center rounded bg-surface-gray-2">
            <span class="lucide-globe size-3.5 text-ink-gray-5" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm text-ink-gray-8">{{ row.serverLabel }}</div>
            <div class="text-xs text-ink-gray-5">{{ row.roleName }}</div>
          </div>
          <div class="flex shrink-0 flex-wrap justify-end gap-1">
            <span v-if="row.permissions.administrator" class="rounded bg-surface-amber-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-amber-8">Admin</span>
            <span v-for="p in row.enabledPerms" :key="p.key" class="rounded bg-surface-gray-2 px-1.5 py-0.5 text-[10px] text-ink-gray-6">{{ p.short }}</span>
            <span v-if="!row.permissions.administrator && !row.enabledPerms.length" class="text-xs text-ink-gray-4">View only</span>
          </div>
        </div>
      </div>

      <!-- Manage mode: role assignment editor -->
      <div v-else-if="memberDialogMode === 'manage'" class="space-y-3">
        <Alert v-if="draftHasExclusive" theme="yellow" title="Admin for all resources already covers every permission">
          <template #description>
            The roles below stay saved but inactive while this is on. Remove the Admin (all resources) or Owner role to use them again.
          </template>
        </Alert>
        <div v-for="(dr, i) in draftRoles" :key="i" class="flex items-center gap-2" :class="isRowCovered(i) ? 'opacity-50' : ''">
          <div class="flex-1">
            <FormControl type="select" :modelValue="dr.roleId" :options="roleSelectOptions" :disabled="isRowCovered(i)" @update:modelValue="(v) => setDraftRoleId(i, v)" />
          </div>
          <span class="shrink-0 text-xs text-ink-gray-4">on</span>
          <div class="flex-1">
            <FormControl type="select" :modelValue="dr.resourceId" :options="serverSelectOptions" :disabled="isRowCovered(i)" @update:modelValue="(v) => setDraftResourceId(i, v)" />
          </div>
          <Button variant="ghost" size="sm" icon="lucide-x" aria-label="Remove" :disabled="isRowCovered(i)" @click="removeDraftRole(i)" />
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
      <p class="text-p-sm text-ink-gray-6">
        They'll immediately lose access to <span class="font-medium text-ink-gray-8">{{ store.team.name }}</span> and all its servers and sites. You can re-invite them at any time.
      </p>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="removeMemberOpen = false" />
          <Button variant="solid" label="Remove" @click="confirmRemoveMember" />
        </div>
      </template>
    </Dialog>

    <!-- Leave team -->
    <Dialog v-model:open="leaveOpen" size="sm">
      <template #title>
        <span class="text-xl font-semibold text-ink-gray-9">{{ leaveStep === 1 ? 'Transfer ownership first' : 'Leave team' }}</span>
      </template>
      <div v-if="leaveStep === 1" class="space-y-3">
        <p class="text-p-sm text-ink-gray-6">You're the Owner. Choose someone to take over before you leave.</p>
        <FormControl v-model="newOwnerForLeave" type="select" label="New owner" :options="nonOwnerMemberOptions" />
      </div>
      <div v-else>
        <p class="text-p-sm text-ink-gray-6">
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
        <p class="text-p-sm text-ink-gray-6">These members have this role. Assign them a new role before deleting.</p>
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
import { Avatar, Badge, Button, Dialog, Dropdown, FormControl, Switch, TabButtons, toast, Tooltip } from 'frappe-ui'
import Alert from '../../components/Alert.vue'
import CentralShell from '../../components/CentralShell.vue'
import { useCloudStore } from '../../stores/cloud'
import { providerById, regionById } from '../../data/catalog'

const store = useCloudStore()

const tabs = [
  { label: 'Team', value: 'team' },
  { label: 'Roles', value: 'roles' },
]
const tab = ref('team')

// ── Search (issue #12) ───────────────────────────────────────
const memberQuery = ref('')
const roleQuery = ref('')

const filteredMembers = computed(() => {
  const q = memberQuery.value.trim().toLowerCase()
  if (!q) return store.members
  return store.members.filter((m) => {
    const roleNames = (m.roles || [])
      .map((r) => store.roles.find((x) => x.id === r.roleId)?.name || '')
      .join(' ')
    return `${m.name} ${m.email} ${roleNames}`.toLowerCase().includes(q)
  })
})

const filteredRoles = computed(() => {
  const q = roleQuery.value.trim().toLowerCase()
  if (!q) return store.roles
  return store.roles.filter((r) => `${r.name} ${r.desc || ''}`.toLowerCase().includes(q))
})

// Clear the query when switching tabs so results don't carry over.
watch(tab, () => {
  memberQuery.value = ''
  roleQuery.value = ''
})

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

// Create-sites is reserved for Admin roles (issue #7): it can't be granted on
// its own, and turning Administrator off withdraws it.
function setPermission(permissions, key, value) {
  if (key === 'createSites' && value && !permissions.administrator) return
  permissions[key] = value
  if (key === 'administrator') {
    if (value) {
      Object.keys(permissions).forEach((k) => { permissions[k] = true })
    } else {
      permissions.createSites = false
    }
  }
}

// The Create-sites toggle is locked unless this role is an Administrator.
function permLocked(perm, permissions) {
  return perm.key === 'createSites' && !permissions.administrator
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
// Only the Owner can touch the Owner — assign it (transfer) or change who holds
// it. An Admin who used to be Owner must not be able to manage the new Owner.
const loggedInIsOwner = computed(() => {
  const m = loggedInMember.value
  if (!m) return true
  return memberIsOwner(m)
})
const teamInitial = computed(() => (store.team?.name || 'T')[0].toUpperCase())

// Only the Owner can hand out the Owner role (a transfer); everyone else sees
// every role except Owner.
const assignableRoles = computed(() =>
  store.roles.filter((r) => r.id !== 'role-owner' || loggedInIsOwner.value)
)
const roleSelectOptions = computed(() =>
  assignableRoles.value.map((r) => ({ label: r.name, value: r.id, description: r.desc }))
)
const roleInviteOptions = computed(() =>
  assignableRoles.value.map((r) => ({ label: r.name, value: r.id, description: r.desc }))
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

// ── Frappe Partner ────────────────────────────────────────────

const partnerOpen = ref(false)
const partnerDraft = ref('')
function openPartner() {
  partnerDraft.value = store.partnerCode
  partnerOpen.value = true
}
function savePartner() {
  if (!partnerDraft.value.trim()) return
  store.setPartnerCode(partnerDraft.value)
  toast.success('Linked to Partner team')
  partnerOpen.value = false
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
  // The Owner's roles aren't editable here — ownership changes via transfer/leave.
  if (isAdminOrOwner.value && !memberIsOwner(m)) {
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

// An Owner or an Admin-for-ALL-resources role grants full access. A
// specific-resource admin (role-admin WITH a resourceId) does not and can
// coexist with other roles.
const exclusiveIndex = computed(() =>
  draftRoles.value.findIndex((r) =>
    r.roleId === 'role-owner' || (r.roleId === 'role-admin' && !r.resourceId)
  )
)
const draftHasExclusive = computed(() => exclusiveIndex.value !== -1)

// When such a role is present, the OTHER rows are kept but disabled — granting
// admin no longer silently wipes a member's existing role settings. (#17)
function isRowCovered(i) {
  return draftHasExclusive.value && i !== exclusiveIndex.value
}

function setDraftRoleId(i, roleId) {
  draftRoles.value[i].roleId = roleId
}

function setDraftResourceId(i, resourceId) {
  draftRoles.value[i].resourceId = resourceId
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
    addMember.memberId = ''
    addMember.resourceId = ''
  }
})

function openRoleDialog(r) {
  roleDialogRole.value = r
  roleDialogOpen.value = true
}

// Members already on the team who don't yet hold this role (issue #7 — no invite).
function addableMemberOptions(roleId) {
  return store.members
    .filter((m) => !m.roles?.some((r) => r.roleId === roleId))
    .map((m) => ({ label: m.name, value: m.id, description: m.email }))
}
// Member + resource picker for the role dialog (issue #16). Owner is always
// all-resources, so its resourceId stays empty.
const addMember = reactive({ memberId: '', resourceId: '' })
function confirmAddMemberToRole() {
  if (!addMember.memberId || !roleDialogRole.value) return
  const isOwner = roleDialogRole.value.id === 'role-owner'
  const resourceId = isOwner ? null : addMember.resourceId || null
  store.addMemberToRole(roleDialogRole.value.id, addMember.memberId, resourceId)
  const m = store.members.find((x) => x.id === addMember.memberId)
  const scope = resourceId ? store.servers.find((s) => s.id === resourceId)?.name : 'all servers'
  toast.success(`Added ${m?.name || 'member'} to ${roleDialogRole.value.name} on ${scope}`)
  addMember.memberId = ''
  addMember.resourceId = ''
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

</script>
