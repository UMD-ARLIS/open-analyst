import { useEffect, useId, useRef, useState } from 'react';
import type { HeadlessProject, HeadlessProjectMember } from '~/lib/headless-api';

type ProjectStorageForm = {
  workspaceLocalRoot: string;
  artifactBackend: string;
  artifactLocalRoot: string;
  artifactS3Bucket: string;
  artifactS3Region: string;
  artifactS3Endpoint: string;
  artifactS3Prefix: string;
};

interface ProjectSettingsDialogProps {
  open: boolean;
  project: HeadlessProject | null;
  isSaving?: boolean;
  canManageProject?: boolean;
  onCancel: () => void;
  onSave: (values: ProjectStorageForm) => void;
}

function toInitialState(project: HeadlessProject | null): ProjectStorageForm {
  return {
    workspaceLocalRoot: project?.workspaceLocalRoot || '',
    artifactBackend: project?.artifactBackend || 'env',
    artifactLocalRoot: project?.artifactLocalRoot || '',
    artifactS3Bucket: project?.artifactS3Bucket || '',
    artifactS3Region: project?.artifactS3Region || '',
    artifactS3Endpoint: project?.artifactS3Endpoint || '',
    artifactS3Prefix: project?.artifactS3Prefix || '',
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

export function ProjectSettingsDialog({
  open,
  project,
  isSaving = false,
  canManageProject = false,
  onCancel,
  onSave,
}: ProjectSettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<ProjectStorageForm>(() => toInitialState(project));
  const [members, setMembers] = useState<HeadlessProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersBusy, setMembersBusy] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const workspaceRootId = useId();
  const localArtifactRootId = useId();
  const s3BucketId = useId();
  const s3RegionId = useId();
  const s3EndpointId = useId();
  const s3PrefixId = useId();

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  useEffect(() => {
    setForm(toInitialState(project));
  }, [project]);

  useEffect(() => {
    if (!open || !project) return;
    let cancelled = false;
    setMembersLoading(true);
    setMemberError('');
    void fetch(`/api/projects/${encodeURIComponent(project.id)}/members`)
      .then(async (response) => {
        const body = await readJson(response);
        if (!response.ok) {
          throw new Error(String(body.error || 'Failed to load project members'));
        }
        if (!cancelled) {
          setMembers(Array.isArray(body.members) ? (body.members as HeadlessProjectMember[]) : []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMemberError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, project]);

  if (!open || !project) return null;

  const isS3 = form.artifactBackend === 's3';
  const isLocal = form.artifactBackend === 'local';

  const handleSubmit = () => {
    if (!canManageProject) return;
    onSave(form);
  };

  const applyMemberResponse = (body: Record<string, unknown>) => {
    if (Array.isArray(body.members)) {
      setMembers(body.members as HeadlessProjectMember[]);
    }
  };

  const addMember = async () => {
    if (!canManageProject) return;
    const identifier = inviteIdentifier.trim();
    if (!identifier) return;
    setMembersBusy(true);
    setMemberError('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, role: inviteRole }),
      });
      const body = await readJson(response);
      if (!response.ok) {
        throw new Error(String(body.error || 'Failed to add member'));
      }
      applyMemberResponse(body);
      setInviteIdentifier('');
      setInviteRole('editor');
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : String(error));
    } finally {
      setMembersBusy(false);
    }
  };

  const updateMemberRole = async (memberUserId: string, role: 'editor' | 'viewer') => {
    if (!canManageProject) return;
    setMembersBusy(true);
    setMemberError('');
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/members/${encodeURIComponent(memberUserId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        }
      );
      const body = await readJson(response);
      if (!response.ok) {
        throw new Error(String(body.error || 'Failed to update member role'));
      }
      applyMemberResponse(body);
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : String(error));
    } finally {
      setMembersBusy(false);
    }
  };

  const removeMember = async (memberUserId: string) => {
    if (!canManageProject) return;
    setMembersBusy(true);
    setMemberError('');
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/members/${encodeURIComponent(memberUserId)}`,
        { method: 'DELETE' }
      );
      const body = await readJson(response);
      if (!response.ok) {
        throw new Error(String(body.error || 'Failed to remove member'));
      }
      applyMemberResponse(body);
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : String(error));
    } finally {
      setMembersBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <dialog
        ref={dialogRef}
        className="bg-surface rounded-xl border border-border shadow-2xl p-0 w-full max-w-4xl mx-4 backdrop:bg-transparent"
        onClose={onCancel}
      >
        <div className="p-5 space-y-5" onClick={(event) => event.stopPropagation()}>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-text-primary">Project Settings</h3>
            <p className="text-sm text-text-secondary">
              Manage project storage and collaboration access for this shared workspace.
            </p>
          </div>

          {!canManageProject ? (
            <div className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm text-text-secondary">
              Your access to this project is <span className="font-medium">{project.accessRole || 'viewer'}</span>.
              Only project owners can change storage settings or manage members.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-text-primary">Storage</h4>
                <p className="text-sm text-text-secondary">
                  Configure where this project keeps its workspace and artifacts.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor={workspaceRootId} className="text-sm text-text-secondary">
                    Workspace root override
                  </label>
                  <input
                    id={workspaceRootId}
                    type="text"
                    className="input w-full"
                    disabled={!canManageProject || isSaving}
                    value={form.workspaceLocalRoot}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        workspaceLocalRoot: event.target.value,
                      }))
                    }
                    placeholder="Use .env default when blank"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-sm text-text-secondary">Workspace slug</span>
                  <div className="input w-full flex items-center bg-background-secondary text-text-secondary">
                    {project.workspaceSlug || project.id}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm text-text-secondary">Artifact backend</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'env', label: 'Use .env defaults' },
                    { value: 'local', label: 'Local override' },
                    { value: 's3', label: 'S3 override' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!canManageProject || isSaving}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        form.artifactBackend === option.value
                          ? 'border-accent bg-accent-muted text-accent'
                          : 'border-border text-text-secondary hover:bg-surface-hover'
                      } ${!canManageProject || isSaving ? 'opacity-60 cursor-not-allowed' : ''}`}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          artifactBackend: option.value,
                        }))
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {(form.artifactBackend === 'env' || isLocal) && (
                <div className="space-y-1">
                  <label htmlFor={localArtifactRootId} className="text-sm text-text-secondary">
                    Local artifact root override
                  </label>
                  <input
                    id={localArtifactRootId}
                    type="text"
                    className="input w-full"
                    disabled={!canManageProject || isSaving}
                    value={form.artifactLocalRoot}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        artifactLocalRoot: event.target.value,
                      }))
                    }
                    placeholder={isLocal ? 'Absolute path for project artifacts' : 'Optional override'}
                  />
                </div>
              )}

              {(form.artifactBackend === 'env' || isS3) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor={s3BucketId} className="text-sm text-text-secondary">
                      S3 bucket override
                    </label>
                    <input
                      id={s3BucketId}
                      type="text"
                      className="input w-full"
                      disabled={!canManageProject || isSaving}
                      value={form.artifactS3Bucket}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          artifactS3Bucket: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={s3RegionId} className="text-sm text-text-secondary">
                      S3 region override
                    </label>
                    <input
                      id={s3RegionId}
                      type="text"
                      className="input w-full"
                      disabled={!canManageProject || isSaving}
                      value={form.artifactS3Region}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          artifactS3Region: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={s3EndpointId} className="text-sm text-text-secondary">
                      S3 endpoint override
                    </label>
                    <input
                      id={s3EndpointId}
                      type="text"
                      className="input w-full"
                      disabled={!canManageProject || isSaving}
                      value={form.artifactS3Endpoint}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          artifactS3Endpoint: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={s3PrefixId} className="text-sm text-text-secondary">
                      S3 prefix override
                    </label>
                    <input
                      id={s3PrefixId}
                      type="text"
                      className="input w-full"
                      disabled={!canManageProject || isSaving}
                      value={form.artifactS3Prefix}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          artifactS3Prefix: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm text-text-secondary">
                Files are stored under the project workspace slug, and artifact metadata keeps both
                the raw storage URI and the stable app link.
              </div>
            </section>

            <section className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-text-primary">Members</h4>
                <p className="text-sm text-text-secondary">
                  Owners can add collaborators by email or username after they sign in once.
                </p>
              </div>

              {memberError ? (
                <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {memberError}
                </div>
              ) : null}

              <div className="rounded-xl border border-border bg-background-secondary divide-y divide-border">
                {membersLoading ? (
                  <div className="px-4 py-3 text-sm text-text-secondary">Loading members…</div>
                ) : members.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-text-secondary">No members found.</div>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-text-primary truncate">
                          {member.name || member.username || member.email || member.userId}
                        </div>
                        <div className="text-xs text-text-muted truncate">
                          {member.email || member.username || member.userId}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {member.isOwner ? (
                          <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                            Owner
                          </span>
                        ) : (
                          <>
                            <select
                              className="input py-1 text-sm"
                              disabled={!canManageProject || membersBusy}
                              value={member.role}
                              onChange={(event) =>
                                void updateMemberRole(
                                  member.userId,
                                  event.target.value === 'viewer' ? 'viewer' : 'editor'
                                )
                              }
                            >
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            {canManageProject ? (
                              <button
                                type="button"
                                className="btn btn-secondary text-sm"
                                disabled={membersBusy}
                                onClick={() => void removeMember(member.userId)}
                              >
                                Remove
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {canManageProject ? (
                <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    <label className="text-sm">
                      Email or username
                      <input
                        className="input mt-1"
                        value={inviteIdentifier}
                        onChange={(event) => setInviteIdentifier(event.target.value)}
                        placeholder="analyst@example.com"
                      />
                    </label>
                    <label className="text-sm">
                      Role
                      <select
                        className="input mt-1"
                        value={inviteRole}
                        onChange={(event) =>
                          setInviteRole(event.target.value === 'viewer' ? 'viewer' : 'editor')
                        }
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary text-sm"
                    disabled={membersBusy || !inviteIdentifier.trim()}
                    onClick={() => void addMember()}
                  >
                    {membersBusy ? 'Saving…' : 'Add member'}
                  </button>
                </div>
              ) : null}
            </section>
          </div>

          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={onCancel} disabled={isSaving}>
              Close
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isSaving || !canManageProject}
            >
              {isSaving ? 'Saving...' : 'Save storage'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
