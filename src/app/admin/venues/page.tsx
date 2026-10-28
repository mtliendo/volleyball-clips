import { VenueManager } from "@/components/admin/venue-manager";
import { requireAdminPage } from "@/lib/admin";
import { listVenues } from "@/lib/queries";

export default async function AdminVenuesPage() {
  await requireAdminPage("/admin/venues");
  const venues = await listVenues();

  return (
    <div className="space-y-4">
      <h1 className="display text-section">Venues</h1>
      <VenueManager venues={venues} />
    </div>
  );
}
