import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Términos de Servicio | FoodNetPR",
  description: "Términos de servicio de FoodNetPR - Plataforma de entrega de comida en Puerto Rico",
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">Términos de Servicio</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-10">
          <div className="prose prose-slate max-w-none">
            <p className="text-sm text-slate-500 mb-6">Última actualización: Marzo 2026</p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">1. Aceptación de los Términos</h2>
              <p className="text-slate-600 leading-relaxed">
                Al acceder o utilizar la plataforma FoodNetPR, disponible en{" "}
                <a href="https://prdelivery.com" className="text-rose-600 hover:underline">
                  https://prdelivery.com
                </a>
                , usted acepta estar sujeto a estos Términos de Servicio. Si no está de acuerdo con 
                alguna parte de estos términos, no debe utilizar nuestros servicios.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">2. Descripción del Servicio</h2>
              <p className="text-slate-600 leading-relaxed">
                FoodNetPR es una plataforma de marketplace de entrega de alimentos que opera en Puerto Rico. 
                Conectamos a consumidores con restaurantes locales, facilitando el pedido y la entrega de 
                alimentos a domicilio o para recogida. Actuamos como intermediario entre usted y los 
                restaurantes participantes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">3. Cuentas de Usuario</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Para realizar pedidos, debe crear una cuenta proporcionando información precisa y completa. 
                Usted es responsable de:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>Mantener la confidencialidad de su contraseña y credenciales de acceso</li>
                <li>Todas las actividades que ocurran bajo su cuenta</li>
                <li>Notificarnos inmediatamente sobre cualquier uso no autorizado de su cuenta</li>
                <li>Asegurarse de que la información de su cuenta esté actualizada y sea precisa</li>
              </ul>
              <p className="text-slate-600 leading-relaxed mt-4">
                Nos reservamos el derecho de suspender o cancelar cuentas que violen estos términos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">4. Pedidos y Pagos</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Al realizar un pedido a través de FoodNetPR:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>Los precios mostrados incluyen el costo de los alimentos según lo establecido por cada restaurante</li>
                <li>Se aplicarán cargos adicionales por entrega, servicio de despacho e impuestos (IVU) según corresponda</li>
                <li>El pago se procesa al momento de confirmar el pedido</li>
                <li>Aceptamos tarjetas de crédito/débito (procesadas por Stripe) y ATH Móvil</li>
                <li>Los precios pueden variar sin previo aviso y están sujetos a disponibilidad</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">5. Política de Entrega</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Respecto a las entregas:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>Los tiempos de entrega son estimados y pueden variar según condiciones de tráfico, clima y demanda</li>
                <li>Es su responsabilidad proporcionar una dirección de entrega precisa y estar disponible para recibir el pedido</li>
                <li>Las tarifas de entrega se calculan según la distancia y pueden variar por zona</li>
                <li>Algunas áreas pueden no estar dentro de nuestra zona de cobertura</li>
                <li>Para pedidos de recogida (pickup), debe recoger su pedido en el tiempo indicado</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">6. Cancelaciones y Reembolsos</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Nuestra política de cancelaciones y reembolsos es la siguiente:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li><strong>Cancelación antes de preparación:</strong> Reembolso completo si el restaurante aún no ha comenzado a preparar su pedido</li>
                <li><strong>Cancelación durante preparación:</strong> Reembolso parcial o sin reembolso, dependiendo del estado del pedido</li>
                <li><strong>Problemas con el pedido:</strong> Si recibe un pedido incorrecto o con problemas de calidad, contacte a servicio al cliente inmediatamente</li>
                <li><strong>No entrega:</strong> Reembolso completo si el pedido no puede ser entregado por causas atribuibles a nosotros o al restaurante</li>
              </ul>
              <p className="text-slate-600 leading-relaxed mt-4">
                Los reembolsos se procesan al método de pago original y pueden tardar de 5 a 10 días hábiles en reflejarse.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">7. Propinas</h2>
              <p className="text-slate-600 leading-relaxed">
                Las propinas son opcionales pero apreciadas. El 100% de las propinas van directamente a 
                los repartidores. Puede agregar una propina durante el proceso de pago o después de 
                recibir su pedido.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">8. Conducta del Usuario</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Al utilizar FoodNetPR, usted acepta no:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>Proporcionar información falsa o engañosa</li>
                <li>Utilizar la plataforma para fines ilegales</li>
                <li>Interferir con el funcionamiento normal de la plataforma</li>
                <li>Acosar o tratar irrespetuosamente a repartidores, restaurantes o personal de servicio</li>
                <li>Realizar pedidos fraudulentos o con métodos de pago no autorizados</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">9. Limitación de Responsabilidad</h2>
              <p className="text-slate-600 leading-relaxed">
                FoodNetPR actúa como intermediario entre consumidores y restaurantes. No somos responsables 
                por la calidad, seguridad o legalidad de los alimentos preparados por los restaurantes. 
                En la medida máxima permitida por la ley, FoodNetPR no será responsable por daños 
                indirectos, incidentales, especiales o consecuentes que surjan del uso de nuestros servicios.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">10. Propiedad Intelectual</h2>
              <p className="text-slate-600 leading-relaxed">
                Todo el contenido de la plataforma FoodNetPR, incluyendo pero no limitado a texto, 
                gráficos, logotipos, iconos, imágenes y software, es propiedad de FoodNetPR o sus 
                licenciantes y está protegido por las leyes de propiedad intelectual aplicables.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">11. Modificaciones</h2>
              <p className="text-slate-600 leading-relaxed">
                Nos reservamos el derecho de modificar estos Términos de Servicio en cualquier momento. 
                Los cambios entrarán en vigor inmediatamente después de su publicación en la plataforma. 
                El uso continuado de nuestros servicios después de cualquier modificación constituye su 
                aceptación de los nuevos términos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">12. Ley Aplicable</h2>
              <p className="text-slate-600 leading-relaxed">
                Estos Términos de Servicio se rigen e interpretan de acuerdo con las leyes del Estado 
                Libre Asociado de Puerto Rico y las leyes federales de los Estados Unidos de América. 
                Cualquier disputa que surja de estos términos estará sujeta a la jurisdicción exclusiva 
                de los tribunales de Puerto Rico.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">13. Contacto</h2>
              <p className="text-slate-600 leading-relaxed">
                Para preguntas sobre estos Términos de Servicio, puede contactarnos en:
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
