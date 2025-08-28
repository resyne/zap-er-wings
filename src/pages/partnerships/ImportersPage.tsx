import { ImporterKanban } from "@/components/partnerships/ImporterKanban";

export default function ImportersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Importers</h1>
          <p className="text-muted-foreground">
            Manage your network of certified importers and distribution partners
          </p>
        </div>
      </div>

      {/* Kanban Pipeline */}
      <ImporterKanban />
    </div>
  );
}