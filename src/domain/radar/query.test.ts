import { describe, expect, it } from "vitest";
import { buildRadarQuery, hasKids, shiftDeparture, windowDates } from "./query";

const trip = {
  originIata: "BUE",
  destinationIata: "BRC",
  originLabel: "Zárate",
  destinationLabel: "Bariloche",
  startAt: new Date("2027-01-10T03:00:00Z"),
  startTz: "America/Argentina/Buenos_Aires",
  endAt: new Date("2027-01-17T02:59:00Z"),
  endTz: "America/Argentina/Buenos_Aires",
  rooms: 1,
};

describe("consulta del radar", () => {
  it("toma las fechas en la zona del viaje", () => {
    const q = buildRadarQuery(trip, [{ kind: "adult" }, { kind: "adult" }]);
    expect(q.depart).toBe("2027-01-10");
    expect(q.return).toBe("2027-01-16");
    expect(q.adults).toBe(2);
    expect(q.rooms).toBe(1);
    expect(q.originIata).toBe("BUE");
    expect(q.destinationLabel).toBe("Bariloche");
  });

  it("cuenta personas por tipo", () => {
    const q = buildRadarQuery(trip, [{ kind: "adult" }, { kind: "child" }, { kind: "infant" }]);
    expect([q.adults, q.children, q.infants]).toEqual([1, 1, 1]);
    expect(hasKids(q)).toBe(true);
    expect(hasKids(buildRadarQuery(trip, [{ kind: "adult" }]))).toBe(false);
  });

  it("corre la vuelta al cambiar la ida", () => {
    const q = shiftDeparture(buildRadarQuery(trip, [{ kind: "adult" }]), "2027-01-11");
    expect([q.depart, q.return]).toEqual(["2027-01-11", "2027-01-17"]);
  });
});

describe("ventana de fechas", () => {
  it("arma la ventana de 7 días con la misma duración", () => {
    const w = windowDates("2027-01-10", "2027-01-16", 3, "2026-11-14");
    expect(w).toHaveLength(7);
    expect(w[0]).toEqual({ depart: "2027-01-07", return: "2027-01-13" });
    expect(w[6]).toEqual({ depart: "2027-01-13", return: "2027-01-19" });
  });

  it("no incluye días pasados", () => {
    expect(windowDates("2026-11-15", "2026-11-20", 3, "2026-11-14").map((d) => d.depart)).toEqual([
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
    ]);
  });

  it("cruza fin de mes", () => {
    expect(windowDates("2027-02-01", "2027-02-05", 3, "2026-11-14")[0]!.depart).toBe("2027-01-29");
  });
});
