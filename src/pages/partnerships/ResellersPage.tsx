import { ResellerKanban } from "@/components/partnerships/ResellerKanban";

export default function ResellersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Resellers</h1>
          <p className="text-muted-foreground">
            Manage your network of authorized resellers and retail partners
          </p>
        </div>
      </div>

      {/* Kanban Pipeline */}
      <ResellerKanban />
    </div>
  );
}