"use client";

import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { TBody, Table, Td, Tr } from "@/components/ui/table";
import type { ProjectRole, User } from "@/lib/api/client";
import { projectApi, useProjectMutation, useProjects, useUserMemberships } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";

const ROLES: ProjectRole[] = ["manager", "contributor", "viewer"];

/** Which projects an account can open, and with which role (instance admins: all of them). */
export function ProjectAccessDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t, errorMessage } = useI18n();
  const { data: projects } = useProjects(false);
  const { data: memberships } = useUserMemberships(user?.id ?? 0);
  const grant = useProjectMutation(projectApi.setMember);
  const revoke = useProjectMutation(projectApi.removeMember);
  const error = grant.error ?? revoke.error;
  const busy = grant.isPending || revoke.isPending;
  const roleIn = (id: number) => memberships?.find((m) => m.project_id === id)?.role ?? "";

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={t("users.projects")} description={user?.username} closeLabel={t("common.close")}>
        {user?.role === "admin" ? (
          <p className="text-sm text-muted-foreground">{t("users.projectsAdmin")}</p>
        ) : !projects?.length ? (
          <p className="text-sm text-muted-foreground">{t("users.projectsNone")}</p>
        ) : (
          <Table>
            <TBody>
              {projects.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-medium">{p.name}</Td>
                  <Td>
                    <Select
                      aria-label={t("users.projectRole", { name: p.name })}
                      value={roleIn(p.id)}
                      disabled={busy}
                      onChange={(e) => {
                        const target = { id: p.id, userId: user!.id };
                        if (e.target.value) grant.mutate({ ...target, role: e.target.value as ProjectRole });
                        else revoke.mutate(target);
                      }}
                    >
                      <option value="">{t("users.noAccess")}</option>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`projectRole.${r}`)}
                        </option>
                      ))}
                    </Select>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
        {error && <Alert tone="danger" className="mt-3">{errorMessage(error)}</Alert>}
      </DialogContent>
    </Dialog>
  );
}
