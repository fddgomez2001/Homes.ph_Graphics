// Builds the Windows installer (after scripts/build-desktop.mjs), then checks it:
//   npm run desktop:dist   → dist/Homes.ph-SocMedSystem-Setup-<version>.exe
//                             dist/Homes.ph-SocMedSystem-Setup-<version>.exe.sha256.txt
//
// Code signing (so Windows and antivirus programs trust the app): set ONE of these before building.
//   - A certificate file (.pfx / .p12):           CSC_LINK=<path or base64>  CSC_KEY_PASSWORD=<password>
//   - A certificate in the Windows store / token: WIN_CERT_SUBJECT=<the certificate's name>
//     (cloud or USB-token certificates, e.g. SSL.com eSigner or Certum SimplySign, installed with the vendor's tool)
//     or WIN_CERT_SHA1=<the certificate's thumbprint>
// Without one the installer is built unsigned (Windows SmartScreen then says "Windows protected your PC":
// More info → Run anyway). Every signed file is time-stamped, so it stays valid after the certificate expires.
//
// After building: the SHA-256 checksum is written next to the installer, and Microsoft Defender scans it.
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
// DCM_OUT=dist/next: build into another folder (dist\win-unpacked is in use while the app runs from it);
// the installer and its checksum are then copied into dist\ as usual.
const outDir = process.env.DCM_OUT ? path.resolve(root, process.env.DCM_OUT) : path.join(root, "dist")
const installer = path.join(outDir, `Homes.ph-SocMedSystem-Setup-${pkg.version}.exe`)

const args = ["--win", "--publish", "never", ...(process.env.DCM_OUT ? [`-c.directories.output=${outDir}`] : [])]
const subject = process.env.WIN_CERT_SUBJECT?.trim()
const sha1 = process.env.WIN_CERT_SHA1?.trim()
if (subject) args.push(`-c.win.signtoolOptions.certificateSubjectName=${subject}`)
else if (sha1) args.push(`-c.win.signtoolOptions.certificateSha1=${sha1}`)
const signing = !!(subject || sha1 || process.env.CSC_LINK || process.env.WIN_CSC_LINK)
console.log(signing ? "  • code signing: on" : "  • code signing: off (no certificate set; see scripts/dist-desktop.mjs)")

// electron-builder's own CLI, run with this Node (no shell, so arguments are passed as they are).
const cli = path.join(root, "node_modules", "electron-builder", "cli.js")
const built = spawnSync(process.execPath, [cli, ...args], { cwd: root, stdio: "inherit" })
if (built.status !== 0) process.exit(built.status ?? 1)
if (!fs.existsSync(installer)) {
  console.error(`The installer wasn't made: ${path.relative(root, installer)}`)
  process.exit(1)
}

// The checksum, so whoever downloads it can check it's the same file (PowerShell: Get-FileHash <file>).
const hash = createHash("sha256").update(fs.readFileSync(installer)).digest("hex").toUpperCase()
fs.writeFileSync(`${installer}.sha256.txt`, `${hash}  ${path.basename(installer)}\n`)
console.log(`  • SHA-256 ${hash}`)

// Microsoft Defender's own scan of the installer (Windows only; skipped when Defender isn't there).
const defender = path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Windows Defender", "MpCmdRun.exe")
if (process.platform === "win32" && fs.existsSync(defender)) {
  const scan = spawnSync(defender, ["-Scan", "-ScanType", "3", "-File", installer, "-DisableRemediation"], { encoding: "utf8" })
  const out = `${scan.stdout ?? ""}${scan.stderr ?? ""}`
  if (/found no threats/i.test(out)) console.log("  • Microsoft Defender: no threats found")
  else {
    console.error(`  • Microsoft Defender flagged the installer (exit ${scan.status}):\n${out.trim()}`)
    process.exit(2)
  }
} else console.log("  • Microsoft Defender scan skipped (not available here)")

// Signed or not (PowerShell's Get-AuthenticodeSignature).
if (process.platform === "win32") {
  const sig = spawnSync("powershell.exe", ["-NoProfile", "-Command", `(Get-AuthenticodeSignature -LiteralPath '${installer.replace(/'/g, "''")}').Status`], { encoding: "utf8" })
  console.log(`  • signature: ${(sig.stdout ?? "").trim() || "unknown"}`)
}

if (process.env.DCM_OUT) {
  const dist = path.join(root, "dist")
  for (const f of [installer, `${installer}.sha256.txt`]) fs.copyFileSync(f, path.join(dist, path.basename(f)))
  console.log(`  • copied to ${path.relative(root, path.join(dist, path.basename(installer)))}`)
}
