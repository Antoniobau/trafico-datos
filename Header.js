export default function Header(){ return (
  <header className="py-6 border-b border-b-transparent">
    <div className="container mx-auto flex justify-between items-center px-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-md bg-gray-800 flex items-center justify-center">🌐</div>
        <div>
          <div className="font-bold">Tráfico de Datos</div>
          <div className="text-sm text-gray-400">Analítica & Crecimiento</div>
        </div>
      </div>
      <nav className="flex gap-4 items-center">
        <a className="text-sm text-gray-300" href="#plans">Planes</a>
        <a className="btn" href="#signup">Crear cuenta</a>
      </nav>
    </div>
  </header>
)}