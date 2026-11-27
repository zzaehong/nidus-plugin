// Renders the SVGs in this folder to PNG (macOS NSImage reads SVG). Run: swift assets/render.swift (from the repo root)
import AppKit
func png(_ svg: String, px: Int, pt: Int, to path: String) {
  let img = NSImage(data: svg.data(using: .utf8)!)!
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8, samplesPerPixel: 4,
                             hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  rep.size = NSSize(width: pt, height: pt) // 2x pixels per point → crisp on Retina menu bars
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  img.draw(in: NSRect(x: 0, y: 0, width: pt, height: pt))
  NSGraphicsContext.restoreGraphicsState()
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}
let logo = try! String(contentsOfFile: "assets/logo.svg", encoding: .utf8)
png(logo, px: 512, pt: 512, to: "plugin/.claude-plugin/icon.png")
let bar = try! String(contentsOfFile: "assets/menubar.svg", encoding: .utf8)
try! FileManager.default.createDirectory(atPath: "assets/menubar", withIntermediateDirectories: true)
// Apple system colors, same meaning as the old emoji: idle, working, waiting, Telegram down, off
for (state, color) in [("idle", "#34C759"), ("working", "#0A84FF"), ("waiting", "#FFCC00"), ("tgdown", "#FF9500"), ("off", "#FF3B30")] {
  png(bar.replacingOccurrences(of: "EGG", with: color), px: 36, pt: 18, to: "assets/menubar/\(state).png")
}
print("ok")
