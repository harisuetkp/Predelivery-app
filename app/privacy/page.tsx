import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Política de Privacidad | FoodNetPR",
  description: "Política de privacidad de FoodNetPR - Plataforma de entrega de comida en Puerto Rico",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">Política de Privacidad</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-10">
          <div className="prose prose-slate max-w-none">
            <p className="text-sm text-slate-500 mb-6">Última actualización: Marzo 2026</p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">1. Introducción</h2>
              <p className="text-slate-600 leading-relaxed">
                Bienvenido a FoodNetPR. Esta Política de Privacidad explica cómo recopilamos, usamos, 
                divulgamos y protegemos su información cuando utiliza nuestra plataforma de entrega de 
                alimentos en Puerto Rico, accesible en{" "}
                <a href="https://prdelivery.com" className="text-rose-600 hover:underline">
                  https://prdelivery.com
                </a>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">2. Información que Recopilamos</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Recopilamos información que usted nos proporciona directamente cuando utiliza nuestros servicios:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li><strong>Información de cuenta:</strong> Nombre completo, dirección de correo electrónico, número de teléfono</li>
                <li><strong>Información de entrega:</strong> Direcciones de entrega, instrucciones especiales de entrega</li>
                <li><strong>Información de pago:</strong> Datos de tarjeta de crédito/débito procesados de forma segura a través de nuestros proveedores de pago</li>
                <li><strong>Historial de pedidos:</strong> Restaurantes favoritos, pedidos anteriores, preferencias alimentarias</li>
                <li><strong>Información de ubicación:</strong> Ubicación geográfica para calcular tiempos y tarifas de entrega</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">3. Cómo Usamos su Información</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Utilizamos la información recopilada para los siguientes propósitos:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>Procesar y entregar sus pedidos de alimentos</li>
                <li>Comunicarnos con usted sobre el estado de sus pedidos</li>
                <li>Proporcionar atención al cliente y responder a sus consultas</li>
                <li>Enviar notificaciones sobre promociones y ofertas especiales (con su consentimiento)</li>
                <li>Mejorar nuestros servicios y experiencia de usuario</li>
                <li>Cumplir con obligaciones legales y regulatorias</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">4. Servicios de Terceros</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Para proporcionar nuestros servicios, utilizamos los siguientes proveedores de terceros:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li><strong>Stripe:</strong> Procesamiento seguro de pagos con tarjeta de crédito y débito</li>
                <li><strong>ATH Móvil:</strong> Procesamiento de pagos locales en Puerto Rico</li>
                <li><strong>Google Maps:</strong> Servicios de geolocalización y cálculo de rutas de entrega</li>
                <li><strong>Supabase:</strong> Almacenamiento seguro de datos y autenticación de usuarios</li>
              </ul>
              <p className="text-slate-600 leading-relaxed mt-4">
                Cada uno de estos proveedores tiene sus propias políticas de privacidad que rigen el uso de su información.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">5. Seguridad de Datos</h2>
              <p className="text-slate-600 leading-relaxed">
                Implementamos medidas de seguridad técnicas y organizativas para proteger su información personal, 
                incluyendo encriptación de datos en tránsito y en reposo, acceso restringido a información personal, 
                y monitoreo continuo de nuestros sistemas. Sin embargo, ningún método de transmisión por Internet 
                es 100% seguro, y no podemos garantizar la seguridad absoluta de sus datos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">6. Sus Derechos</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Usted tiene los siguientes derechos con respecto a su información personal:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li><strong>Acceso:</strong> Solicitar una copia de la información personal que tenemos sobre usted</li>
                <li><strong>Corrección:</strong> Solicitar la corrección de información inexacta o incompleta</li>
                <li><strong>Eliminación:</strong> Solicitar la eliminación de su información personal y cuenta</li>
                <li><strong>Portabilidad:</strong> Solicitar una copia de sus datos en un formato estructurado</li>
                <li><strong>Objeción:</strong> Oponerse al procesamiento de su información para ciertos fines</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">7. Retención de Datos</h2>
              <p className="text-slate-600 leading-relaxed">
                Conservamos su información personal mientras mantenga una cuenta activa con nosotros o según sea 
                necesario para proporcionarle nuestros servicios. También podemos retener cierta información según 
                lo requieran las leyes aplicables o para fines comerciales legítimos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">8. Cambios a esta Política</h2>
              <p className="text-slate-600 leading-relaxed">
                Podemos actualizar esta Política de Privacidad periódicamente. Le notificaremos sobre cambios 
                significativos publicando la nueva política en nuestra plataforma y actualizando la fecha de 
                "Última actualización". Le recomendamos revisar esta política regularmente.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">9. Contacto</h2>
              <p className="text-slate-600 leading-relaxed">
                Si tiene preguntas o inquietudes sobre esta Política de Privacidad o sobre cómo manejamos 
                su información personal, puede contactarnos en:
              </p>
              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <p className="text-slate-700">
                  <strong>Email:</strong>{" "}
                  <a href="mailto:foodnetpr.mail@gmail.com" className="text-rose-600 hover:underline">
                    foodnetpr.mail@gmail.com
                  </a>
                </p>
                <p className="text-slate-700 mt-2">
                  <strong>Plataforma:</strong>{" "}
                  <a href="https://prdelivery.com" className="text-rose-600 hover:underline">
                    https://prdelivery.com
                  </a>
                </p>
              </div>
            </section>
          </div>

          {/* Back to home link */}
          <div className="mt-10 pt-6 border-t border-slate-200">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-rose-600 hover:text-rose-700 font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
