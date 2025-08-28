import { InstallerKanban } from "@/components/partnerships/InstallerKanban";

export default function InstallersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Installers</h1>
          <p className="text-muted-foreground">
            Manage your network of certified installers and service partners
          </p>
        </div>
      </div>

      {/* Kanban Pipeline */}
      <InstallerKanban />
    </div>
  );
}