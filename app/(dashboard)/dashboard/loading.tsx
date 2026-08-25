export default function DashboardLoading() {
  return (
    <div className="dashboard-loading" aria-label="در حال آماده‌سازی داشبورد">
      <div className="dashboard-loading-hero" />
      <div className="dashboard-loading-actions">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} />
        ))}
      </div>
      <div className="dashboard-loading-metrics">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} />
        ))}
      </div>
      <div className="dashboard-loading-panels">
        <div />
        <div />
      </div>
    </div>
  );
}
