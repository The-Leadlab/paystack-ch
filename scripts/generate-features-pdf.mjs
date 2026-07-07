import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "docs", "PAYSTACK_FEATURES_COMPARISON_CH.html");
const pdfPath = path.join(root, "docs", "PAYSTACK_FEATURES_COMPARISON_CH.pdf");

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle0" });
await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();
console.log("Wrote", pdfPath);
