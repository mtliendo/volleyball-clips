import { TagManager } from "@/components/admin/tag-manager";
import { requireAdminPage } from "@/lib/admin";
import { listTags } from "@/lib/queries";

export default async function AdminTagsPage() {
  await requireAdminPage("/admin/tags");
  const tags = await listTags();

  return (
    <div className="space-y-4">
      <h1 className="display text-section">Tags</h1>
      <p className="meta">
        Seeded list: spike, block, dig, ace, set, save, rally. Add more if the footage needs it.
      </p>
      <TagManager tags={tags} />
    </div>
  );
}
