import { describe, expect, it } from "vitest";
import { segmentsFromForm } from "./segments";

describe("segmentsFromForm", () => {
  it("un tramo usa origen y destino de la alternativa", () => {
    expect(
      segmentsFromForm({ fromLabel: "AEP", toLabel: "BRC", tz: "TZ", seg_departDate_0: "2027-01-10", seg_departTime_0: "10:00", seg_arriveDate_0: "2027-01-10", seg_arriveTime_0: "12:20" }),
    ).toEqual([
      { from: "AEP", to: "BRC", departDate: "2027-01-10", departTime: "10:00", departTz: "TZ", arriveDate: "2027-01-10", arriveTime: "12:20", arriveTz: "TZ" },
    ]);
  });

  it("con escalas encadena los puntos intermedios", () => {
    const segs = segmentsFromForm({
      fromLabel: "EZE",
      toLabel: "MAD",
      tz: "BA",
      seg_departDate_0: "2027-03-01",
      seg_departTime_0: "10:00",
      seg_arriveDate_0: "2027-03-01",
      seg_arriveTime_0: "12:00",
      seg_via_1: "GRU",
      seg_departDate_1: "2027-03-01",
      seg_departTime_1: "13:00",
      seg_arriveDate_1: "2027-03-02",
      seg_arriveTime_1: "06:30",
      seg_arriveTz_1: "Europe/Madrid",
    });
    expect(segs.map((s) => `${s.from}-${s.to}`)).toEqual(["EZE-GRU", "GRU-MAD"]);
    expect(segs[1]!.arriveTz).toBe("Europe/Madrid");
    expect(segs[0]!.arriveTz).toBe("BA");
  });

  it("sin fecha de salida no hay tramos", () => {
    expect(segmentsFromForm({ fromLabel: "A", toLabel: "B", tz: "BA", seg_departDate_0: "" })).toEqual([]);
  });
});
