import type { Operation } from "./calculator";

export type Discount = { id: string; name: string; percent: number; note: string; operations?: Operation[]; paired?: boolean };
export const discounts: Discount[] = [
  { id: "paired", name: "За встречную сделку: продажа + покупка в одном городе", percent: 3, note: "Из комиссии текущей сделки вычитаются 3% от её комиссии и 3% от комиссии ранее совершённой встречной сделки. Предоставляется в случае оплаты комиссии по первой сделке. Срок действия скидки - не более шести месяцев между датами задатка. Степень родства при предоставлении скидки: мать, отец, сын, дочь, муж, жена, родители мужа/жены.", paired: true },
  { id: "large-family", name: "Многодетным семьям", percent: 3, note: "При наличии удостоверения многодетной семьи." },
  { id: "disability", name: "Инвалидам 1-3 группы", percent: 3, note: "При наличии действующей справки о группе инвалидности (результаты медико-социальной экспертизы - МСЭ)." },
  { id: "pensioner", name: "Пенсионерам", percent: 3, note: "При наличии пенсионного удостоверения." },
  { id: "svo", name: "Участникам СВО", percent: 3, note: "При наличии удостоверения участника СВО." },
  { id: "veteran", name: "Ветеранам ВОВ", percent: 3, note: "При наличии удостоверения ветерана ВОВ." },
  { id: "repeat-3", name: "Повторное обращение: 3-4 объекта в одном городе", percent: 3, note: "Продажа/Покупка в течение года от трех до четырех объектов недвижимости на себя или родственников первой линии, при наличии документов, подтверждающих родство (свидетельство о рождении, свидетельство о заключении брака). Степень родства при предоставлении скидки: мать, отец, сын, дочь, муж, жена, родители мужа/жены." },
  { id: "repeat-5", name: "Повторное обращение: от 5 объектов в одном городе", percent: 5, note: "Продажа/Покупка в течение года от пяти объектов недвижимости на себя или родственников первой линии, при наличии документов, подтверждающих родство (свидетельство о рождении, свидетельство о заключении брака). Степень родства при предоставлении скидки: мать, отец, сын, дочь, муж, жена, родители мужа/жены." },
  { id: "new-build", name: "За продажу вторичного жилья и покупку новостройки в одном городе", percent: 7, note: "Предоставляется только при подписанном договоре долевого участия. Возможен возврат скидки по продаже после покупки новостройки. Срок действия скидки - не более шести месяцев между датами задатка. Степень родства при предоставлении скидки: мать, отец, сын, дочь, муж, жена, родители мужа/жены.", operations: ["sale"] },
  { id: "certificate", name: "По сертификатам переселенцев с ДНР, ЛНР и Херсонской области", percent: 10, note: "Только для клиентов-покупателей при расчетах за объект посредством сертификата переселения из ДНР, ЛНР и Херсонской обл. Скидки не суммируются с другими скидками. Степень родства при предоставлении скидки: мать, отец, сын, дочь, муж, жена, родители мужа/жены.", operations: ["purchase"] },
];

// Discounts reduce the tariff commission, including any tariff minimum.
// Round the payable amount to rubles; derive savings from the same amount.
export function applyDiscount(commission: number, percent: number) {
  const total = Math.round(commission * (100 - percent) / 100 + Number.EPSILON * commission);
  return { total, saving: commission - total };
}

export function applyPairedDiscount(commission: number, previousCommission: number) {
  const currentSaving = applyDiscount(commission, 3).saving;
  const previousSaving = applyDiscount(previousCommission, 3).saving;
  const requestedSaving = currentSaving + previousSaving;
  const saving = Math.min(commission, requestedSaving);
  const total = Math.max(0, commission - saving);
  return { total, saving, currentSaving, previousSaving, capped: requestedSaving > commission };
}
