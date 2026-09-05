import { PlotDims, Facing } from "./plot";
import { SolvedRoom } from "./solve";
import { inchesToFeet } from "./units";

export type BoqQualityTier = "economy" | "standard" | "luxury";

export interface BoqItem {
  code: string;
  category: "civil" | "masonry" | "finishes" | "openings" | "mep" | "labor";
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  specNotes?: string;
}

export interface BoqCategorySummary {
  category: "civil" | "masonry" | "finishes" | "openings" | "mep" | "labor";
  name: string;
  amount: number;
  percentage: number;
}

export interface BoqEstimate {
  tier: BoqQualityTier;
  carpetAreaSqFt: number;
  builtUpAreaSqFt: number;
  plotAreaSqFt: number;
  totalCost: number;
  costPerSqFt: number;
  materialCost: number;
  laborCost: number;
  items: BoqItem[];
  categories: BoqCategorySummary[];
  keyQuantities: {
    cementBags: number;
    steelTons: number;
    brickCount: number;
    sandTons: number;
    aggregateTons: number;
    flooringSqFt: number;
    paintSqFt: number;
  };
}

const TIER_MULTIPLIERS: Record<BoqQualityTier, { ratePerSqFt: number; label: string }> = {
  economy: { ratePerSqFt: 1650, label: "Economy Standard" },
  standard: { ratePerSqFt: 2150, label: "Premium Residential" },
  luxury: { ratePerSqFt: 2950, label: "Ultra-Luxury Studio" },
};

/**
 * Computes exact engineering Bill of Quantities (BOQ) takeoff
 * based on the solved architectural rooms, wall lengths, and plot dimensions.
 */
export function calculateBoq(
  plot: PlotDims,
  facing: Facing,
  rooms: SolvedRoom[],
  tier: BoqQualityTier = "standard"
): BoqEstimate {
  const plotWFt = inchesToFeet(plot.widthIn);
  const plotDFt = inchesToFeet(plot.depthIn);
  const plotAreaSqFt = Math.round(plotWFt * plotDFt);

  // 1. Area Analysis
  let carpetAreaSqFt = 0;
  let totalWallLengthFt = 0;
  let bathroomAreaSqFt = 0;
  let kitchenAreaSqFt = 0;

  for (const r of rooms) {
    const rw = inchesToFeet(r.w_in);
    const rd = inchesToFeet(r.d_in);
    const area = rw * rd;
    carpetAreaSqFt += area;
    totalWallLengthFt += 2 * (rw + rd);

    if (r.name.includes("bath") || r.name.includes("toilet")) {
      bathroomAreaSqFt += area;
    } else if (r.name.includes("kitchen")) {
      kitchenAreaSqFt += area;
    }
  }

  // Built-up area includes outer walls and plinth projection (~15% above carpet area)
  const builtUpAreaSqFt = Math.max(100, Math.round(carpetAreaSqFt * 1.15));

  // 2. Structural RCC Concrete & Excavation
  const slabVolumeCuFt = builtUpAreaSqFt * (5 / 12); // 5 inch RCC slab
  const columnCount = Math.max(6, Math.round(rooms.length * 2.2));
  const columnVolumeCuFt = columnCount * (0.75 * 1.0 * 10); // 9"x12" columns, 10ft high
  const plinthBeamVolumeCuFt = (totalWallLengthFt * 0.5) * (0.75 * 1.0); // 9"x12" plinth beams
  const totalRccVolumeCuFt = Math.round(slabVolumeCuFt + columnVolumeCuFt + plinthBeamVolumeCuFt);
  const totalRccVolumeCuM = Math.round((totalRccVolumeCuFt / 35.315) * 10) / 10;

  // Material coefficients for M20 grade concrete (1:1.5:3):
  // 1 m3 concrete ~ 8.2 bags cement, 0.45 m3 sand (~0.7 tons), 0.9 m3 coarse aggregate (~1.3 tons)
  const rccCementBags = Math.round(totalRccVolumeCuM * 8.2);
  const rccSandTons = Math.round(totalRccVolumeCuM * 0.7);
  const rccAggregateTons = Math.round(totalRccVolumeCuM * 1.3);

  // Steel Rebar (Fe500D TMT bars): ~3.8 kg per sq.ft of built-up area
  const steelKg = Math.round(builtUpAreaSqFt * 3.85);
  const steelTons = Math.round((steelKg / 1000) * 100) / 100;

  // 3. Masonry Brickwork
  // 9" exterior + 4.5" interior partition walls. Avg 10ft height.
  // Deduction for doors (approx 21 sq.ft each) and windows (approx 16 sq.ft each)
  const doorCount = Math.max(3, rooms.length + 1);
  const windowCount = Math.max(2, Math.round(rooms.length * 1.4));
  const openingDeductionSqFt = doorCount * 21 + windowCount * 16;
  const grossWallAreaSqFt = totalWallLengthFt * 10;
  const netWallAreaSqFt = Math.max(100, Math.round(grossWallAreaSqFt - openingDeductionSqFt));

  // Standard modular bricks: ~480 bricks per 100 sq.ft of 9" wall (or 240 for 4.5" partition)
  // Assuming 40% exterior 9", 60% interior 4.5" -> avg 336 bricks / 100 sq.ft
  const brickCount = Math.round(netWallAreaSqFt * 3.4);
  const masonryCementBags = Math.round(netWallAreaSqFt * 0.09);
  const masonrySandTons = Math.round(netWallAreaSqFt * 0.018);

  // 4. Plastering & Painting
  // Plastering: internal (2 sides of walls) + ceiling
  const internalPlasterSqFt = Math.round(netWallAreaSqFt * 1.8 + builtUpAreaSqFt);
  const externalPlasterSqFt = Math.round(totalWallLengthFt * 0.4 * 11);
  const plasterCementBags = Math.round((internalPlasterSqFt + externalPlasterSqFt) * 0.038);
  const plasterSandTons = Math.round((internalPlasterSqFt + externalPlasterSqFt) * 0.007);

  const totalCementBags = rccCementBags + masonryCementBags + plasterCementBags;
  const totalSandTons = rccSandTons + masonrySandTons + plasterSandTons;

  // Painting
  const interiorPaintSqFt = internalPlasterSqFt;
  const exteriorPaintSqFt = externalPlasterSqFt;

  // Flooring: Carpet area + 10% cutting wastage
  const flooringSqFt = Math.round(carpetAreaSqFt * 1.1);

  // Pricing Unit Rates based on selected quality tier
  const tierConfig = TIER_MULTIPLIERS[tier];
  const rateMult = tier === "economy" ? 0.8 : tier === "luxury" ? 1.4 : 1.0;

  const items: BoqItem[] = [
    // Civil & Structural
    {
      code: "CIV-01",
      category: "civil",
      description: "Earthwork excavation in foundation trenches & footings",
      quantity: Math.round(builtUpAreaSqFt * 1.2),
      unit: "cu.ft",
      rate: Math.round(18 * rateMult),
      amount: Math.round(builtUpAreaSqFt * 1.2 * 18 * rateMult),
      specNotes: "Depth up to 5ft in hard soil",
    },
    {
      code: "CIV-02",
      category: "civil",
      description: "P.C.C 1:4:8 under footings & plinth flooring bed",
      quantity: Math.round(builtUpAreaSqFt * 0.35),
      unit: "cu.ft",
      rate: Math.round(160 * rateMult),
      amount: Math.round(builtUpAreaSqFt * 0.35 * 160 * rateMult),
      specNotes: "40mm graded stone aggregate",
    },
    {
      code: "CIV-03",
      category: "civil",
      description: "R.C.C M20 design mix concrete in columns, beams & 5\" slab",
      quantity: totalRccVolumeCuFt,
      unit: "cu.ft",
      rate: Math.round(380 * rateMult),
      amount: Math.round(totalRccVolumeCuFt * 380 * rateMult),
      specNotes: "Machine batched & vibrated with waterproofing compound",
    },
    {
      code: "CIV-04",
      category: "civil",
      description: "High-yield Fe500D TMT Reinforcement Steel bars",
      quantity: steelKg,
      unit: "kg",
      rate: Math.round(72 * (tier === "luxury" ? 1.15 : 1.0)),
      amount: Math.round(steelKg * 72 * (tier === "luxury" ? 1.15 : 1.0)),
      specNotes: "Includes cutting, bending, binding wire & test certificates",
    },

    // Masonry
    {
      code: "MAS-01",
      category: "masonry",
      description: "First class table-molded red brick masonry in C.M 1:6",
      quantity: brickCount,
      unit: "nos",
      rate: Math.round(11 * rateMult),
      amount: Math.round(brickCount * 11 * rateMult),
      specNotes: "Crushing strength > 75 kg/cm2",
    },
    {
      code: "MAS-02",
      category: "masonry",
      description: "Cement sand plastering (12mm internal + 20mm external sponge)",
      quantity: internalPlasterSqFt + externalPlasterSqFt,
      unit: "sq.ft",
      rate: Math.round(32 * rateMult),
      amount: Math.round((internalPlasterSqFt + externalPlasterSqFt) * 32 * rateMult),
      specNotes: "Smooth trowel finish inside, double-coat weatherproof outside",
    },

    // Finishes
    {
      code: "FIN-01",
      category: "finishes",
      description: tier === "luxury"
        ? "Italian Marble / High-end Statuario Glazed Vitrified Tiles (4x2 ft)"
        : tier === "standard"
        ? "Double Charged Vitrified Tiles (2x2 ft) with 4\" skirting"
        : "Standard Ceramic Floor Tiles with joint spacer grouting",
      quantity: flooringSqFt,
      unit: "sq.ft",
      rate: Math.round((tier === "luxury" ? 190 : tier === "standard" ? 95 : 55) * rateMult),
      amount: Math.round(flooringSqFt * (tier === "luxury" ? 190 : tier === "standard" ? 95 : 55) * rateMult),
      specNotes: "Includes polymer adhesive bed & epoxy grout",
    },
    {
      code: "FIN-02",
      category: "finishes",
      description: "Bathroom anti-skid floor & 7ft high glazed wall dado tiles",
      quantity: Math.max(80, Math.round(bathroomAreaSqFt * 3.8)),
      unit: "sq.ft",
      rate: Math.round(85 * rateMult),
      amount: Math.round(Math.max(80, Math.round(bathroomAreaSqFt * 3.8)) * 85 * rateMult),
      specNotes: "Waterproof epoxy jointing",
    },
    {
      code: "FIN-03",
      category: "finishes",
      description: "Interior luxury emulsion painting (2 coats putty + 1 primer + 2 paint)",
      quantity: interiorPaintSqFt,
      unit: "sq.ft",
      rate: Math.round(34 * rateMult),
      amount: Math.round(interiorPaintSqFt * 34 * rateMult),
      specNotes: "Low VOC washable sheen finish",
    },
    {
      code: "FIN-04",
      category: "finishes",
      description: "Exterior anti-fungal weather-shield acrylic apex paint",
      quantity: exteriorPaintSqFt,
      unit: "sq.ft",
      rate: Math.round(28 * rateMult),
      amount: Math.round(exteriorPaintSqFt * 28 * rateMult),
      specNotes: "UV resistant silicone additives",
    },

    // Openings
    {
      code: "OPN-01",
      category: "openings",
      description: tier === "luxury"
        ? "Bespoke Carved Teakwood Main Entrance Door & Heavy Brass Hardware"
        : "Standard Hardwood Main Entrance Frame & 35mm Designer Shutter",
      quantity: 1,
      unit: "set",
      rate: Math.round(tier === "luxury" ? 48000 : 26000),
      amount: Math.round(tier === "luxury" ? 48000 : 26000),
      specNotes: "Complete with mortise lock & eye viewer",
    },
    {
      code: "OPN-02",
      category: "openings",
      description: "Internal Bedroom & Toilet flush doors with laminate/WPC finish",
      quantity: Math.max(2, doorCount - 1),
      unit: "nos",
      rate: Math.round(9500 * rateMult),
      amount: Math.round(Math.max(2, doorCount - 1) * 9500 * rateMult),
      specNotes: "Waterproof core & stainless steel cylindrical locks",
    },
    {
      code: "OPN-03",
      category: "openings",
      description: "UPVC / Powder Coated Aluminum 3-track sliding windows with mosquito mesh",
      quantity: windowCount,
      unit: "nos",
      rate: Math.round(8500 * rateMult),
      amount: Math.round(windowCount * 8500 * rateMult),
      specNotes: "5mm toughened safety glass with MS safety grill",
    },

    // MEP (Mechanical, Electrical, Plumbing)
    {
      code: "MEP-01",
      category: "mep",
      description: "Concealed electrical piping, FRLS copper wiring & modular switches",
      quantity: Math.round(builtUpAreaSqFt),
      unit: "sq.ft",
      rate: Math.round(110 * rateMult),
      amount: Math.round(builtUpAreaSqFt * 110 * rateMult),
      specNotes: "Includes MCB distribution board, inverter wiring & earthing",
    },
    {
      code: "MEP-02",
      category: "mep",
      description: "Sanitaryware & CPVC/PVC plumbing lines (water supply & sewage)",
      quantity: Math.max(1, Math.round(rooms.length / 2)),
      unit: "bath units",
      rate: Math.round(32000 * rateMult),
      amount: Math.round(Math.max(1, Math.round(rooms.length / 2)) * 32000 * rateMult),
      specNotes: "Wall-hung commode, diverter, basin & overhead water tank piping",
    },
  ];

  // Calculate Subtotals & Categories
  const totalCost = items.reduce((acc, it) => acc + it.amount, 0);
  const costPerSqFt = Math.round(totalCost / builtUpAreaSqFt);
  const materialCost = Math.round(totalCost * 0.68);
  const laborCost = Math.round(totalCost * 0.32);

  const catNames: Record<BoqItem["category"], string> = {
    civil: "Civil & Substructure",
    masonry: "Masonry & Plaster",
    finishes: "Flooring, Painting & Finishes",
    openings: "Doors & Windows",
    mep: "Electrical & Plumbing",
    labor: "Labor & Scaffolding",
  };

  const catMap = new Map<BoqItem["category"], number>();
  for (const it of items) {
    catMap.set(it.category, (catMap.get(it.category) || 0) + it.amount);
  }

  const categories: BoqCategorySummary[] = Array.from(catMap.entries()).map(([cat, amt]) => ({
    category: cat,
    name: catNames[cat],
    amount: amt,
    percentage: Math.round((amt / totalCost) * 100),
  }));

  return {
    tier,
    carpetAreaSqFt,
    builtUpAreaSqFt,
    plotAreaSqFt,
    totalCost,
    costPerSqFt,
    materialCost,
    laborCost,
    items,
    categories,
    keyQuantities: {
      cementBags: totalCementBags,
      steelTons,
      brickCount,
      sandTons: totalSandTons,
      aggregateTons: rccAggregateTons,
      flooringSqFt,
      paintSqFt: interiorPaintSqFt + exteriorPaintSqFt,
    },
  };
}

/**
 * Exports BOQ takeoff to a downloadable CSV spreadsheet
 */
export function exportBoqToCsv(boq: BoqEstimate, projectName: string = "Architectural_Takeoff"): void {
  const lines: string[] = [];
  lines.push(`"PROJECT BILL OF QUANTITIES (BOQ) & ESTIMATE"`);
  lines.push(`"Quality Tier:","${boq.tier.toUpperCase()}"`);
  lines.push(`"Plot Area:","${boq.plotAreaSqFt} sq.ft"`);
  lines.push(`"Carpet Area:","${boq.carpetAreaSqFt} sq.ft"`);
  lines.push(`"Built-Up Area:","${boq.builtUpAreaSqFt} sq.ft"`);
  lines.push(`"Total Estimated Budget:","₹${boq.totalCost.toLocaleString()}"`);
  lines.push(`"Cost per Sq.Ft:","₹${boq.costPerSqFt}/sq.ft"`);
  lines.push(`"Material Cost (68%):","₹${boq.materialCost.toLocaleString()}"`);
  lines.push(`"Labor Cost (32%):","₹${boq.laborCost.toLocaleString()}"`);
  lines.push("");

  lines.push(`"KEY MATERIAL QUANTITIES"`);
  lines.push(`"Cement:","${boq.keyQuantities.cementBags} Bags (50kg)"`);
  lines.push(`"Steel Rebar (TMT Fe500D):","${boq.keyQuantities.steelTons} Metric Tons"`);
  lines.push(`"Bricks:","${boq.keyQuantities.brickCount.toLocaleString()} Nos"`);
  lines.push(`"Sand / M-Sand:","${boq.keyQuantities.sandTons} Tons"`);
  lines.push(`"Coarse Aggregate (20mm):","${boq.keyQuantities.aggregateTons} Tons"`);
  lines.push(`"Flooring Tiles:","${boq.keyQuantities.flooringSqFt} sq.ft"`);
  lines.push(`"Painting Area:","${boq.keyQuantities.paintSqFt} sq.ft"`);
  lines.push("");

  lines.push(`"DETAILED ITEM TAKEOFF"`);
  lines.push(`"Item Code","Category","Description","Qty","Unit","Unit Rate (₹)","Amount (₹)","Specification Notes"`);

  for (const it of boq.items) {
    const desc = it.description.replace(/"/g, '""');
    const notes = (it.specNotes || "").replace(/"/g, '""');
    lines.push(
      `"${it.code}","${it.category}","${desc}","${it.quantity}","${it.unit}","${it.rate}","${it.amount}","${notes}"`
    );
  }

  const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(lines.join("\n"));
  const a = document.createElement("a");
  a.setAttribute("href", csvContent);
  a.setAttribute("download", `${projectName}_BOQ_Estimate.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Triggers clean browser print dialog with formatted architectural estimate sheet
 */
export function printBoqReport(boq: BoqEstimate, projectName: string = "Architectural Floor Plan"): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Bill of Quantities (BOQ) - ${projectName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; color: #1e293b; }
          .header { border-bottom: 2px solid #1a1916; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
          h1 { margin: 0; font-size: 24px; color: #1a1916; }
          .badge { background: #d3dee1; color: #2f4954; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 13px; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
          .stat-card { background: #eceae5; border: 1px solid #d8d4cb; padding: 12px; border-radius: 8px; }
          .stat-label { font-size: 11px; color: #6d685e; text-transform: uppercase; font-weight: 600; }
          .stat-value { font-size: 18px; font-weight: 700; color: #1a1916; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
          th { background: #eceae5; text-align: left; padding: 8px 10px; border: 1px solid #b5b0a6; font-weight: 700; }
          td { padding: 8px 10px; border: 1px solid #d8d4cb; }
          tr:nth-child(even) { background: #eceae5; }
          .amount-col { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
          .total-row { font-weight: 800; background: #d8d4cb !important; font-size: 13px; }
          .footer { margin-top: 40px; border-top: 1px solid #b5b0a6; padding-top: 14px; display: flex; justify-content: space-between; font-size: 11px; color: #8e8a82; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1> Bill of Quantities (BOQ) &amp; Material Takeoff</h1>
            <div style="font-size: 13px; color: #6d685e; margin-top: 4px;">Project: ${projectName} • Date: ${new Date().toLocaleDateString()}</div>
          </div>
          <span class="badge">${boq.tier.toUpperCase()} TIER</span>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Estimated Cost</div>
            <div class="stat-value">₹${boq.totalCost.toLocaleString()}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Built-Up Area</div>
            <div class="stat-value">${boq.builtUpAreaSqFt} sq.ft</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Rate per Sq.Ft</div>
            <div class="stat-value">₹${boq.costPerSqFt}/sq.ft</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Structural Steel (TMT)</div>
            <div class="stat-value">${boq.keyQuantities.steelTons} Tons</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 70px;">Code</th>
              <th>Description &amp; Specifications</th>
              <th style="width: 70px; text-align: right;">Qty</th>
              <th style="width: 60px;">Unit</th>
              <th style="width: 90px; text-align: right;">Rate (₹)</th>
              <th style="width: 110px; text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${boq.items
              .map(
                (it) => `
              <tr>
                <td><strong>${it.code}</strong></td>
                <td>${it.description} ${it.specNotes ? `<br><small style="color:#6d685e;">${it.specNotes}</small>` : ""}</td>
                <td style="text-align: right;">${it.quantity.toLocaleString()}</td>
                <td>${it.unit}</td>
                <td style="text-align: right;">${it.rate.toLocaleString()}</td>
                <td class="amount-col">₹${it.amount.toLocaleString()}</td>
              </tr>
            `
              )
              .join("")}
            <tr class="total-row">
              <td colspan="5" style="text-align: right;">TOTAL ESTIMATED COST:</td>
              <td class="amount-col">₹${boq.totalCost.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <span>Generated by Plot to Plan CAD Studio • CP-SAT Algorithmic Architecture Engine</span>
          <span>Architect / Structural Consultant Signature: _______________________</span>
        </div>
        <script>
          window.onload = () => window.print();
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
