import { Skeleton, SkeletonStatus } from "./Skeleton";

function bars(count) {
  return Array.from({ length: count }, (_, index) => index);
}

export function AppShellSkeleton({ label = "Loading" }) {
  return (
    <SkeletonStatus label={label} className="skeleton-shell">
      <Skeleton height={72} radius={0} />
      <div className="skeleton-shell-body">
        <Skeleton height={28} width={220} />
        <StatTilesSkeleton count={4} />
        <Skeleton height={220} radius={12} />
      </div>
    </SkeletonStatus>
  );
}

export function StatTilesSkeleton({ count = 4, label }) {
  const tiles = (
    <div className="skeleton-stat-row">
      {bars(count).map((index) => (
        <Skeleton key={index} className="skeleton-stat" height={72} />
      ))}
    </div>
  );
  if (!label) return tiles;
  return <SkeletonStatus label={label}>{tiles}</SkeletonStatus>;
}

export function CardGridSkeleton({
  count = 6,
  label = "Loading",
  imageHeight = 140,
  gridClassName = "skeleton-card-grid",
}) {
  return (
    <SkeletonStatus label={label}>
      <div className={gridClassName}>
        {bars(count).map((index) => (
          <div className="skeleton-card" key={index}>
            <Skeleton height={imageHeight} radius={0} />
            <div className="skeleton-card-body">
              <Skeleton height={14} width="78%" />
              <Skeleton height={12} width="52%" />
              <Skeleton height={12} width="36%" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonStatus>
  );
}

export function SupplierCardGridSkeleton({
  count = 8,
  label = "Loading suppliers",
  gridClassName = "skeleton-supplier-grid",
}) {
  return (
    <SkeletonStatus label={label}>
      <div className={gridClassName}>
        {bars(count).map((index) => (
          <div className="skeleton-card" key={index}>
            <Skeleton height={180} radius={0} />
            <div className="skeleton-card-body">
              <Skeleton height={16} width="70%" />
              <Skeleton height={12} width="48%" />
              <Skeleton height={12} width="40%" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonStatus>
  );
}

export function WholesalerRowSkeleton({
  count = 4,
  label = "Loading wholesalers",
  gridClassName = "skeleton-wholesaler-row",
}) {
  return (
    <SkeletonStatus label={label}>
      <div className={gridClassName}>
        {bars(count).map((index) => (
          <div className="skeleton-wholesaler" key={index}>
            <Skeleton width={42} height={42} radius="50%" />
            <div className="skeleton-stack" style={{ flex: 1 }}>
              <Skeleton height={14} width="72%" />
              <Skeleton height={12} width="40%" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonStatus>
  );
}

export function TableSkeleton({
  columns = 6,
  rows = 6,
  label = "Loading",
  className = "data-table",
}) {
  return (
    <SkeletonStatus label={label}>
      <table className={`${className} skeleton-table`}>
        <thead>
          <tr>
            {bars(columns).map((index) => (
              <th key={index}>
                <Skeleton height={12} width={`${48 + (index % 3) * 14}%`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bars(rows).map((row) => (
            <tr key={row}>
              {bars(columns).map((column) => (
                <td key={column}>
                  <Skeleton height={14} width={column === columns - 1 ? "46%" : "80%"} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </SkeletonStatus>
  );
}

export function ListRowsSkeleton({ rows = 4, label = "Loading" }) {
  return (
    <SkeletonStatus label={label}>
      <ul className="skeleton-list">
        {bars(rows).map((index) => (
          <li className="skeleton-list-row" key={index}>
            <div className="skeleton-stack" style={{ flex: 1 }}>
              <Skeleton height={14} width="46%" />
              <Skeleton height={12} width="68%" />
            </div>
            <Skeleton height={28} width={72} radius={8} />
          </li>
        ))}
      </ul>
    </SkeletonStatus>
  );
}

export function DashboardSkeleton() {
  return (
    <SkeletonStatus label="Loading dashboard">
      <StatTilesSkeleton count={4} />
      <div className="skeleton-split" style={{ marginTop: 28 }}>
        <div className="skeleton-stack">
          <Skeleton height={14} width={120} />
          <Skeleton height={220} radius={12} />
        </div>
        <div className="skeleton-stack">
          <Skeleton height={14} width={140} />
          <ListRowsSkeleton rows={4} label="Loading activity" />
        </div>
      </div>
      <div className="skeleton-stack" style={{ marginTop: 28 }}>
        <Skeleton height={14} width={160} />
        <TableSkeleton columns={4} rows={4} label="Loading top products" />
      </div>
    </SkeletonStatus>
  );
}

export function SupplierProfileSkeleton() {
  return (
    <SkeletonStatus label="Loading supplier" className="supplier-profile-page">
      <div className="skeleton-profile-bar">
        <Skeleton width={64} height={64} radius="50%" />
        <div className="skeleton-stack">
          <Skeleton height={22} width={220} />
          <Skeleton height={14} width={120} />
        </div>
      </div>
      <Skeleton height={180} radius={12} />
      <div style={{ marginTop: 20 }}>
        <StatTilesSkeleton count={4} />
      </div>
      <div style={{ marginTop: 28 }}>
        <CardGridSkeleton count={6} label="Loading products" imageHeight={160} />
      </div>
    </SkeletonStatus>
  );
}

export function InvoiceListSkeleton() {
  return (
    <SkeletonStatus label="Loading invoices">
      <div className="skeleton-invoice-row" aria-hidden="true">
        {bars(6).map((index) => (
          <Skeleton key={index} height={12} width="70%" />
        ))}
      </div>
      {bars(6).map((row) => (
        <div className="skeleton-invoice-row" key={row}>
          <div className="skeleton-stack">
            <Skeleton height={14} width="78%" />
            <Skeleton height={11} width="48%" />
          </div>
          {bars(5).map((column) => (
            <Skeleton key={column} height={14} width="80%" />
          ))}
        </div>
      ))}
    </SkeletonStatus>
  );
}

export function InvoiceDetailSkeleton() {
  return (
    <main className="invoice-wrap">
      <SkeletonStatus label="Loading invoice" className="skeleton-split">
        <div className="skeleton-stack">
          <Skeleton height={120} radius={12} />
          <Skeleton height={120} radius={12} />
        </div>
        <div className="skeleton-stack">
          <Skeleton height={18} width="46%" />
          <Skeleton height={28} width="38%" />
          <ListRowsSkeleton rows={4} label="Loading timeline" />
          <TableSkeleton columns={5} rows={3} label="Loading invoice items" />
        </div>
      </SkeletonStatus>
    </main>
  );
}

export function ParcelDetailSkeleton() {
  return (
    <SkeletonStatus label="Loading parcel" className="skeleton-split">
      <div className="skeleton-stack">
        {bars(4).map((index) => (
          <Skeleton key={index} height={110} radius={12} />
        ))}
      </div>
      <div className="skeleton-stack">
        <Skeleton className="skeleton-map" />
        <ListRowsSkeleton rows={4} label="Loading tracking" />
      </div>
    </SkeletonStatus>
  );
}

export function CourierCardsSkeleton() {
  return (
    <SkeletonStatus label="Loading assignments">
      <div className="skeleton-card-grid">
        {bars(4).map((index) => (
          <div className="skeleton-card" key={index} style={{ padding: 16, gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <Skeleton height={16} width={80} />
              <Skeleton height={22} width={90} radius={12} />
            </div>
            <Skeleton height={14} width="70%" />
            <Skeleton height={12} width="50%" />
            <Skeleton height={32} width="100%" radius={8} />
          </div>
        ))}
      </div>
    </SkeletonStatus>
  );
}

export function FormFieldsSkeleton({ fields = 5, label = "Loading", includeMap = false }) {
  return (
    <SkeletonStatus label={label} className="skeleton-stack">
      {includeMap && <Skeleton className="skeleton-map" />}
      {bars(fields).map((index) => (
        <div className="skeleton-stack" key={index} style={{ gap: 6 }}>
          <Skeleton height={12} width={120} />
          <Skeleton className="skeleton-field" />
        </div>
      ))}
    </SkeletonStatus>
  );
}

export function ProductModalSkeleton() {
  return (
    <SkeletonStatus label="Loading product" className="skeleton-product-modal">
      <Skeleton height={280} radius={12} />
      <div className="skeleton-stack">
        <Skeleton height={24} width="80%" />
        <Skeleton height={20} width="36%" />
        <Skeleton height={14} width="50%" />
        <Skeleton height={64} />
        <Skeleton height={40} width={160} radius={8} />
      </div>
    </SkeletonStatus>
  );
}

export function TrackingSkeleton() {
  return <ListRowsSkeleton rows={4} label="Loading tracking" />;
}
