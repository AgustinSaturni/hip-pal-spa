'use client';

export default function Topbar() {
  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-30">
      {/* Breadcrumb / Page title */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Hip-Pal</span>
        <span>/</span>
        <span className="text-gray-900 font-medium">Buscar Paciente</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button
          disabled
          className="relative p-2 text-gray-400 cursor-not-allowed"
          title="Notificaciones (próximamente)"
        >
          <BellIcon />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-200" />

        {/* Doctor profile */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">Dr. Martínez</p>
            <p className="text-[11px] text-gray-500">Traumatología</p>
          </div>
          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-blue-600">DM</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}
