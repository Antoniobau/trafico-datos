import Head from 'next/head'
import Header from '../components/Header'
import Footer from '../components/Footer'

export default function Home(){
  return (
    <>
      <Head><title>Tráfico de Datos Globales</title></Head>
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto py-12 px-4">
          <section className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="logo-box mb-6">
                <div style={{width:140,height:140,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{fontSize:30}}>🌐</div></div>
              </div>
              <h1 className="text-4xl font-bold mb-4">Impulsa tu canal con análisis reales</h1>
              <p className="text-sm text-gray-400 mb-6">Accede a métricas reales... Prueba gratis 3 días.</p>
              <div className="flex gap-4">
                <a className="btn" href="#trial">Probar Gratis 3 Días</a>
                <a className="btn" href="#panel" style={{background:'transparent',border:'1px solid rgba(255,255,255,0.08)'}}>Entrar</a>
              </div>
            </div>
            <div>
              <div className="card p-6">
                <h3 className="text-xl mb-3">Vista previa</h3>
                <div style={{height:300,display:'flex',alignItems:'center',justifyContent:'center'}}>Mockup</div>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  )
}
