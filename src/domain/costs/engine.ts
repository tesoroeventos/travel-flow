import Decimal from "decimal.js";
import { divideCents, money, roundHalfEven } from "../money/money";
import { convert } from "../money/rates";
import { daysDiff } from "../time/calendar";
import {
  COST_CATEGORIES,
  type CostCategory,
  type CostItemInput,
  type CostLine,
  type CostSummary,
  type CostType,
  type CostWarning,
  type ScenarioCostInput,
} from "./types";

export function emptyByCategory(): Record<CostCategory, number> {
  return Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, number>;
}

export function unitMultiplier(item: CostItemInput, travelers: number, tripDays: number): Decimal {
  const nights = item.nights ?? Math.max(tripDays - 1, 0);
  switch (item.unit) {
    case "total":
      return new Decimal(1);
    case "per_person":
      return new Decimal(travelers);
    case "per_night":
      return new Decimal(nights);
    case "per_person_night":
      return new Decimal(travelers).times(nights);
    case "per_day":
      return new Decimal(tripDays);
  }
}

export function computeScenarioCosts(input: ScenarioCostInput): CostSummary {
  const byCategory = emptyByCategory();
  const byCostType: Record<CostType, number> = { fixed: 0, variable: 0, optional: 0 };
  const lines: CostLine[] = [];
  const warnings: CostWarning[] = [];
  let total = 0;
  let confirmed = 0;
  let paid = 0;
  let refundableHeld = 0;
  let incomplete = false;

  if (!input.coverage.hasOutbound) warnings.push({ code: "missing_outbound_transport" });
  if (!input.coverage.hasReturn) warnings.push({ code: "missing_return_transport" });
  if (input.coverage.uncoveredNights > 0) {
    warnings.push({ code: "uncovered_nights", detail: String(input.coverage.uncoveredNights) });
  }

  for (const item of input.items) {
    const multiplier = unitMultiplier(item, input.travelers, input.tripDays);
    const originalCents = roundHalfEven(new Decimal(item.amountCents).times(multiplier).times(item.quantity));
    const conversion = convert(money(originalCents, item.currency), input.baseCurrency, input.rates, input.rateDate);

    if (item.consultedAt) {
      const age = daysDiff(item.consultedAt, input.today);
      if (age > input.staleDays) warnings.push({ code: "stale_price", itemId: item.id, detail: String(age) });
    }
    if (item.includesTaxes === null) warnings.push({ code: "unknown_taxes", itemId: item.id });

    if (!conversion.ok) {
      incomplete = true;
      warnings.push({ code: "missing_exchange_rate", itemId: item.id, detail: `${item.currency}→${input.baseCurrency}` });
      lines.push({
        itemId: item.id,
        multiplier: multiplier.toString(),
        originalCents,
        originalCurrency: item.currency,
        convertedCents: null,
        factor: null,
        status: "missing_rate",
      });
      continue;
    }

    const cents = conversion.data.money.cents;
    lines.push({
      itemId: item.id,
      multiplier: multiplier.toString(),
      originalCents,
      originalCurrency: item.currency,
      convertedCents: cents,
      factor: conversion.data.factor,
      status: item.refundable ? "refundable" : "counted",
    });

    if (item.refundable) {
      refundableHeld += cents;
      continue;
    }
    total += cents;
    byCategory[item.category] += cents;
    byCostType[item.costType] += cents;
    if (item.certainty === "confirmed") confirmed += cents;
    if (item.paymentStatus === "paid") paid += cents;
  }

  const contingencyBase = input.contingencyCategories.reduce((sum, c) => sum + byCategory[c], 0);
  const contingency = roundHalfEven(new Decimal(contingencyBase).times(input.contingencyPct).dividedBy(100));
  const perPerson = divideCents(total, input.travelers);
  const perPersonPerDay = input.tripDays > 0 ? divideCents(total, input.travelers * input.tripDays) : null;

  return {
    totalCents: total,
    contingencyCents: contingency,
    totalWithContingencyCents: total + contingency,
    perPersonCents: perPerson,
    perPersonPerDayCents: perPersonPerDay,
    deviationCents: total + contingency - input.budgetCents,
    byCategory,
    byCostType,
    confirmedCents: confirmed,
    estimatedCents: total - confirmed,
    paidCents: paid,
    pendingCents: total - paid,
    refundableHeldCents: refundableHeld,
    incomplete,
    lines,
    warnings,
  };
}
