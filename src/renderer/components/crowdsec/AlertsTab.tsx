export default function AlertsTab({ seedSearch }: { seedSearch?: string }) {
  void seedSearch
  return <div className="text-sm text-slate-500 p-6">Alerts</div>
}
export function AlertSheet({ id, onClose }: { id: number; onClose: () => void }) {
  void onClose
  return <div>{id}</div>
}
