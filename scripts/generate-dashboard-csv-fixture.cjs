const fs = require("fs");
const path = require("path");

const outPath = path.join(
  __dirname,
  "..",
  "fixtures",
  "paystack-dashboard-test-mixed-flows.csv"
);

const suppliers = [
  "Transgourmet",
  "Manor Food",
  "Coop Pronto",
  "Brauerei Schuetzengarten",
  "Aligro",
  "Swisscom",
  "EWZ",
  "Migros",
  "PostFinance",
  "Twint AG",
  "Booking.com",
  "Resmio",
  "Uber Eats",
  "Deliveroo",
];
const catsExp = ["BILLS", "SUPPLIERS", "FOOD_SUPPLIES", "PAYROLL", "OTHER", "UTILITIES", "RENT"];
const catsInc = ["SALES", "RESERVATION", "SALES", "SALES"];
const pays = ["Card", "Bank transfer", "Cash", "TWINT", "Standing order"];

function csvEscape(v) {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const rows = [];
rows.push(
  "date,flow,invoice_number,supplier,category,description,net_chf,vat_rate,vat_chf,gross_chf,currency,payment_method,iban,notes"
);

let d = new Date("2025-01-02T12:00:00Z");
for (let i = 1; i <= 2800; i += 1) {
  const isIncome = i % 5 === 0;
  const flow = isIncome ? "income" : "expense";
  const supplier = suppliers[i % suppliers.length];
  const category = isIncome ? catsInc[i % catsInc.length] : catsExp[i % catsExp.length];
  const net = Math.round((40 + (i % 90) * 1.37 + (i % 7) * 0.11) * 100) / 100;
  const vatRate = isIncome ? 0.081 : [0.026, 0.038, 0.081][i % 3];
  const vat = Math.round(net * vatRate * 100) / 100;
  const gross = Math.round((net + vat) * 100) / 100;
  const inv = `INV-2025-${String(i).padStart(6, "0")}`;
  const desc = isIncome
    ? ["POS daily settlement", "Reservation deposit", "Card batch settlement", "Catering revenue"][
        i % 4
      ] + ` #${i}`
    : [
        "Beverage crate order",
        "Electricity invoice",
        "Cleaning service",
        "Staff payroll net",
        "Produce delivery",
        "Insurance premium",
      ][i % 6] + ` #${i}`;
  const pay = pays[i % pays.length];
  const iban = `CH93 0076 2011 6238 5295 ${String(i % 100).padStart(2, "0")}`;
  const pad = "_".repeat(20 + (i % 40)) + "x".repeat(40 + (i % 30));
  const notes = `Test row for Paystack dashboard CSV upload. Session demo data line ${i}. Swiss restaurant hospitality ledger sample with enough text padding ${pad}`;
  const date = d.toISOString().slice(0, 10);
  if (i % 2 === 0) d.setUTCDate(d.getUTCDate() + 1);

  rows.push(
    [
      date,
      flow,
      inv,
      supplier,
      category,
      csvEscape(desc),
      net.toFixed(2),
      vatRate.toFixed(3),
      vat.toFixed(2),
      gross.toFixed(2),
      "CHF",
      pay,
      iban,
      csvEscape(notes),
    ].join(",")
  );
}

const out = rows.join("\n") + "\n";
fs.writeFileSync(outPath, out);
console.log("wrote", outPath, "bytes", Buffer.byteLength(out), "rows", rows.length - 1);
