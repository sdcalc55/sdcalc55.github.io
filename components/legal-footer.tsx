"use client";

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3 className="font-semibold text-[#26364A]">{title}</h3><div className="mt-1 space-y-2">{children}</div></div>;
}

function AuthorContact() {
  return <a href="https://t.me/svdemidenko" target="_blank" rel="noopener noreferrer" className="text-[#26364A] underline underline-offset-2">Telegram: @svdemidenko</a>;
}

function LegalDialog({ footer = false }: { footer?: boolean }) {
  return <Dialog>
    <DialogTrigger asChild>
      <button type="button" className={footer ? "w-fit max-w-full shrink-0 rounded-sm text-[11px] leading-5 text-[#748195] transition-colors hover:text-[#26364A] focus-visible:outline-2 focus-visible:outline-offset-4" : "flex min-h-10 w-full items-center justify-between gap-3 text-left text-sm font-medium text-[#26364A] outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#E83C35]"}>{footer ? "Условия использования и политика конфиденциальности" : <><span>Условия использования и политика конфиденциальности</span><span aria-hidden="true" className="text-[#748195]">›</span></>}</button>
    </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 px-5 pt-6 pb-4 pr-10 sm:px-7 sm:pr-12">
          <DialogTitle className="text-left text-lg leading-snug text-[#26364A] sm:text-xl">Условия использования и политика конфиденциальности</DialogTitle>
          <DialogDescription className="text-left text-xs leading-relaxed">SD | Калькулятор</DialogDescription>
        </DialogHeader>
        <div className="select-none min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 text-sm leading-relaxed text-[#536175] sm:px-7" tabIndex={0} aria-label="Текст условий и политики">
          <section aria-labelledby="legal-terms" className="space-y-4">
            <h2 id="legal-terms" className="text-base font-semibold text-[#26364A]">Условия использования</h2>
            <LegalSection title="Общие положения">
              <p>Настоящие Условия определяют порядок использования интернет-сервиса «SD | Калькулятор» (далее - Сервис), а также права и обязанности его Пользователей.</p>
              <p>Использование Сервиса означает согласие Пользователя с настоящими Условиями. В случае несогласия Пользователь обязан прекратить использование Сервиса.</p>
            </LegalSection>
            <LegalSection title="Интеллектуальная собственность">
              <p>Исключительные права на оригинальные элементы Сервиса, включая программный код, структуру, дизайн и авторские материалы, принадлежат Светлане Демиденко, за исключением объектов, права на которые принадлежат третьим лицам.</p>
              <p>Копирование, воспроизведение, распространение, переработка либо иное использование указанных объектов без предварительного согласия правообладателя не допускается, за исключением случаев, предусмотренных законодательством.</p>
              <p>Предоставление доступа к Сервису не означает передачу Пользователю каких-либо исключительных прав на его элементы.</p>
            </LegalSection>
            <LegalSection title="Назначение и ограничения использования">
              <p>Сервис предназначен для выполнения информационно-расчётных операций, связанных с расчётом агентского вознаграждения, параметров ипотечного финансирования и иных предусмотренных функционалом показателей.</p>
              <p>Результаты расчётов носят исключительно информационно-справочный характер, не являются публичной офертой, финансовой, юридической или иной профессиональной рекомендацией и не порождают обязательств для банков, агентств недвижимости и иных третьих лиц.</p>
              <p>Пользователь самостоятельно оценивает применимость результатов расчётов и несёт ответственность за решения, принятые на их основании.</p>
            </LegalSection>
            <LegalSection title="Ограничение ответственности">
              <p>Автор не гарантирует абсолютную точность результатов при некорректном вводе исходных данных, изменении внешних условий или наличии технических ограничений.</p>
              <p>Автор не несёт ответственности за решения и действия Пользователя или третьих лиц, совершённые на основании результатов расчётов, а также за последствия временной недоступности Сервиса, если иное не предусмотрено применимым законодательством.</p>
            </LegalSection>
            <LegalSection title="Заключительные положения">
              <p>Автор вправе изменять функциональность Сервиса и настоящие Условия без предварительного уведомления Пользователей.</p>
              <p>Актуальная редакция Условий размещается непосредственно в Сервисе.</p>
            </LegalSection>
          </section>
          <section aria-labelledby="legal-privacy" className="mt-7 space-y-4 border-t border-[#E4E8ED] pt-6">
            <h2 id="legal-privacy" className="text-base font-semibold text-[#26364A]">Политика конфиденциальности и обработки данных</h2>
            <LegalSection title="Общие положения">
              <p>Настоящая Политика определяет порядок обработки и защиты информации, относящейся к Пользователям Сервиса «SD | Калькулятор».</p>
              <p>Обработка персональных данных осуществляется с соблюдением требований применимого законодательства о персональных данных.</p>
            </LegalSection>
            <LegalSection title="Состав и цели обработки данных">
              <p>Сервис не предусматривает обязательной регистрации Пользователей и не запрашивает их фамилию, имя, отчество, номер телефона или адрес электронной почты.</p>
              <p>Вводимые Пользователем расчётные значения, история операций и пользовательские настройки сохраняются локально в хранилище браузера на устройстве Пользователя и используются исключительно для обеспечения функциональности Сервиса.</p>
              <p>Указанные расчётные данные не передаются автору Сервиса посредством предусмотренного функционала приложения.</p>
              <p>При обращении к Сервису хостинг-провайдер может автоматически обрабатывать техническую информацию, включая IP-адрес, дату и время запроса, сведения о браузере и запрашиваемых ресурсах. Такая обработка осуществляется в целях обеспечения доступности, функционирования и безопасности Сервиса в соответствии с правилами соответствующего провайдера.</p>
            </LegalSection>
            <LegalSection title="Хранение и удаление информации">
              <p>Локально сохранённые данные находятся под контролем Пользователя и могут быть удалены посредством функционала Сервиса либо средствами браузера.</p>
              <p>Автор не осуществляет самостоятельного централизованного хранения расчётной истории Пользователей.</p>
            </LegalSection>
            <LegalSection title="Заключительные положения">
              <p>Настоящая Политика может быть изменена в связи с изменением функциональности Сервиса или требований законодательства.</p>
              <p>По вопросам, связанным с использованием Сервиса и обработкой данных, Пользователь вправе обратиться к автору: <AuthorContact />.</p>
            </LegalSection>
          </section>
        </div>
        <div className="shrink-0 border-t border-[#E4E8ED] px-5 py-3 sm:px-7"><DialogClose asChild><button type="button" className="min-h-10 rounded-xl bg-[#26364A] px-5 text-sm font-medium text-white outline-offset-4 focus-visible:outline-2">Понятно</button></DialogClose></div>
      </DialogContent>
    </Dialog>;
}

export function LegalSettings() {
  return <div>
    <h2 className="mb-3 text-lg font-semibold">Правовая информация</h2>
    <div className="rounded-2xl border border-[#EBEEF2] bg-white p-4"><LegalDialog /></div>
  </div>;
}

export function LegalFooter() {
  return <div className="mt-5 border-t border-[#DDE3EB] pt-4 text-[#748195] sm:mt-7 sm:pt-5">
    <div className="flex flex-col items-center justify-center gap-1 text-center sm:flex-row sm:justify-between sm:gap-4 sm:text-left">
      <p className="select-none text-[11px] leading-5">© 2026 Автор: Светлана Демиденко</p>
      <LegalDialog footer />
    </div>
  </div>;
}
